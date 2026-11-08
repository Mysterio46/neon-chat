import { createOpenAI } from "@ai-sdk/openai";
import { createClient } from "@supabase/supabase-js";
import { APICallError, convertToModelMessages, streamText, type UIMessage } from "ai";

import type { Database, Json } from "@/integrations/supabase/types";
import { isNeonModelId, type NeonModelId } from "@/lib/neon-models";
import { NEON_ROUTING, neonInstructions, neonProviderOptions } from "@/lib/neon-models.server";
import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "./run-id";

const GATEWAY_BASE_URL = "https://ai.gateway.lovable.dev/v1";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(status: number, error: string) {
  return Response.json({ error }, { status });
}

function createSupabaseFetch(key: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(init?.headers);
    if ((key.startsWith("sb_publishable_") || key.startsWith("sb_secret_")) && headers.get("Authorization") === `Bearer ${key}`) {
      headers.delete("Authorization");
    }
    headers.set("apikey", key);
    return fetch(input, { ...init, headers });
  };
}

// Shared, session-less client used only to verify sign-in tokens. Keeping it
// across requests lets it reuse the cached signing keys instead of refetching them.
let verifier: ReturnType<typeof createClient<Database>> | null = null;
function claimsVerifier() {
  if (verifier) return verifier;
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Backend is not configured");
  verifier = createClient<Database>(url, key, {
    global: { fetch: createSupabaseFetch(key) },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  return verifier;
}

// Builds a client scoped to the caller's token. Claims are verified separately so
// the conversation lookup can run at the same time (RLS protects it either way).
function userClient(request: Request) {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Backend is not configured");
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || token.split(".").length !== 3) return null;
  const supabase = createClient<Database>(url, key, {
    global: { fetch: createSupabaseFetch(key), headers: { Authorization: `Bearer ${token}` } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  return { supabase, token };
}

function titleFrom(message: UIMessage | undefined) {
  const text = (message?.parts ?? [])
    .map((p) => (p.type === "text" ? p.text : ""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "New chat";
  return text.length > 60 ? `${text.slice(0, 57).trimEnd()}…` : text;
}

function friendlyError(error: unknown): string {
  const status = APICallError.isInstance(error) ? error.statusCode : undefined;
  if (status === 429) return "Neon is getting a lot of requests right now. Please wait a moment and try again.";
  if (status === 402) return "Neon has run out of AI credits for this workspace. Add credits to keep chatting.";
  if (status === 403) return "Neon isn't allowed to answer this request.";
  if (status && status >= 500) return "Neon had a temporary problem. Please try again.";
  return "Something went wrong while Neon was answering. Please try again.";
}

export async function handleChat(request: Request): Promise<Response> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return json(500, "AI is not configured");

  const client = userClient(request);
  if (!client) return json(401, "Please sign in to chat with Neon.");
  const { supabase, token } = client;

  let body: { messages?: UIMessage[]; conversationId?: string; model?: string };
  try {
    body = await request.json();
  } catch {
    return json(400, "Invalid request");
  }
  const { messages, conversationId } = body;
  if (!Array.isArray(messages) || messages.length === 0) return json(400, "No messages to send");
  if (!conversationId || !UUID_RE.test(conversationId)) return json(400, "Invalid conversation");
  const model: NeonModelId = isNeonModelId(body.model) ? body.model : "neon-3.1";

  // Look up the chat while the caller's sign-in is verified (RLS protects the lookup).
  const convPromise = supabase.from("conversations").select("id, title").eq("id", conversationId).maybeSingle();
  const claimsRes = await claimsVerifier().auth.getClaims(token);
  const userId = claimsRes.data?.claims?.sub as string | undefined;
  if (claimsRes.error || !userId) return json(401, "Please sign in to chat with Neon.");

  // Start Neon's answer immediately; database bookkeeping runs alongside it.
  const routing = NEON_ROUTING[model];
  const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
  const provider = createOpenAI({
    baseURL: GATEWAY_BASE_URL,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });
  const aiAbort = new AbortController();
  request.signal.addEventListener("abort", () => aiAbort.abort(), { once: true });

  const result = streamText({
    model: provider.responses(routing.gatewayModel),
    instructions: neonInstructions(model),
    messages: await convertToModelMessages(messages.map(stripReasoning)),
    abortSignal: aiAbort.signal,
    providerOptions: { openai: neonProviderOptions(model) },
  });

  const convRes = await convPromise;
  if (convRes.error) {
    aiAbort.abort();
    console.error("Failed to load conversation", convRes.error);
    return json(500, "Could not load this chat");
  }

  // New chats are created here, on the first question, instead of in an extra
  // round trip before it.
  let conversation = convRes.data;
  if (!conversation) {
    const { data: created, error: createError } = await supabase
      .from("conversations")
      .insert({
        id: conversationId,
        user_id: userId,
        model,
        title: titleFrom(messages.find((m) => m.role === "user")),
      })
      .select("id, title")
      .single();
    if (createError || !created) {
      aiAbort.abort();
      console.error("Failed to create conversation", createError);
      return json(404, "Chat not found");
    }
    conversation = created;
  }

  const currentTitle = conversation.title;
  const persistUserSide = (async () => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (lastUser) {
      const { error } = await supabase.from("messages").upsert(
        {
          conversation_id: conversationId,
          user_id: userId,
          message_id: lastUser.id,
          role: "user",
          parts: lastUser.parts as unknown as Json,
          metadata: { model },
        },
        { onConflict: "conversation_id,message_id" },
      );
      if (error) console.error("Failed to save user message", error);
    }

    // Drop stored messages the client no longer has (e.g. a regenerated reply).
    const keepIds = messages.map((m) => `"${String(m.id).replace(/["\\,()]/g, "")}"`).join(",");
    const isFirst = currentTitle === "New chat";
    const [{ error: pruneError }, { error: updError }] = await Promise.all([
      supabase
        .from("messages")
        .delete()
        .eq("conversation_id", conversationId)
        .not("message_id", "in", `(${keepIds})`),
      supabase
        .from("conversations")
        .update({
          model,
          updated_at: new Date().toISOString(),
          ...(isFirst ? { title: titleFrom(messages.find((m) => m.role === "user")) } : {}),
        })
        .eq("id", conversationId),
    ]);
    if (pruneError) console.error("Failed to prune messages", pruneError);
    if (updError) console.error("Failed to update conversation", updError);
  })();

  return withLovableAiGatewayRunIdHeader(
    result.toUIMessageStreamResponse({
      originalMessages: messages,
      generateMessageId: () => crypto.randomUUID(),
      sendReasoning: true,
      messageMetadata: () => ({ model }),
      onError: (error) => {
        console.error("Neon stream error", error);
        return friendlyError(error);
      },
      onEnd: async ({ responseMessage }) => {
        await persistUserSide;
        if (!responseMessage?.parts?.length) return;
        const { error } = await supabase.from("messages").upsert(
          {
            conversation_id: conversationId,
            user_id: userId,
            message_id: responseMessage.id,
            role: "assistant",
            parts: responseMessage.parts as unknown as Json,
            metadata: { model },
          },
          { onConflict: "conversation_id,message_id" },
        );
        if (error) console.error("Failed to save Neon reply", error);
      },
    }),
    runIdFetch,
  );
}

// Reasoning items from earlier turns can't always be replayed; keep only visible text.
function stripReasoning(message: UIMessage): UIMessage {
  if (message.role !== "assistant") return message;
  return { ...message, parts: message.parts.filter((p) => p.type === "text") };
}
