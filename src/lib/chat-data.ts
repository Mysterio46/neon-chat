import { queryOptions, type QueryClient } from "@tanstack/react-query";
import type { UIMessage } from "ai";

import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_NEON_MODEL, isNeonModelId, type NeonModelId } from "@/lib/neon-models";

export type Conversation = {
  id: string;
  title: string;
  model: NeonModelId;
  updated_at: string;
};

export const conversationsQuery = () =>
  queryOptions({
    queryKey: ["conversations"],
    queryFn: async (): Promise<Conversation[]> => {
      const { data, error } = await supabase
        .from("conversations")
        .select("id, title, model, updated_at")
        .order("updated_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []).map((c) => ({
        ...c,
        model: isNeonModelId(c.model) ? c.model : DEFAULT_NEON_MODEL,
      }));
    },
  });

export type ThreadData = {
  conversation: Conversation | null;
  messages: UIMessage[];
};

export const threadQuery = (threadId: string) =>
  queryOptions({
    queryKey: ["thread", threadId],
    queryFn: async (): Promise<ThreadData> => {
      const [conv, msgs] = await Promise.all([
        supabase.from("conversations").select("id, title, model, updated_at").eq("id", threadId).maybeSingle(),
        supabase
          .from("messages")
          .select("message_id, role, parts, metadata, created_at")
          .eq("conversation_id", threadId)
          .order("created_at", { ascending: true }),
      ]);
      if (conv.error) throw conv.error;
      if (msgs.error) throw msgs.error;
      const conversation = conv.data
        ? { ...conv.data, model: isNeonModelId(conv.data.model) ? conv.data.model : DEFAULT_NEON_MODEL }
        : null;
      const messages = (msgs.data ?? []).map(
        (m) =>
          ({
            id: m.message_id,
            role: m.role as UIMessage["role"],
            parts: (m.parts ?? []) as UIMessage["parts"],
            metadata: m.metadata ?? undefined,
          }) as UIMessage,
      );
      return { conversation, messages };
    },
    staleTime: Infinity,
    gcTime: 0,
  });

// Starts a new chat instantly on this device. The chat is saved online by the
// server together with the first question, so no wait happens here.
export function startLocalConversation(queryClient: QueryClient, model: NeonModelId, firstText: string): string {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const title = firstText.replace(/\s+/g, " ").trim();
  const conversation: Conversation = {
    id,
    title: title.length > 60 ? `${title.slice(0, 57).trimEnd()}…` : title || "New chat",
    model,
    updated_at: now,
  };
  queryClient.setQueryData<ThreadData>(threadQuery(id).queryKey, { conversation, messages: [] });
  queryClient.setQueryData<Conversation[]>(conversationsQuery().queryKey, (old) => [conversation, ...(old ?? [])]);
  return id;
}

export async function deleteConversation(id: string) {
  const { error } = await supabase.from("conversations").delete().eq("id", id);
  if (error) throw error;
}

// First message typed on the empty "new chat" screen, handed to the thread page
// after navigation so it can be sent with the thread's own chat instance.
const pending = new Map<string, { text: string; model: NeonModelId }>();
export const pendingFirstMessage = {
  set: (threadId: string, value: { text: string; model: NeonModelId }) => pending.set(threadId, value),
  take: (threadId: string) => {
    const value = pending.get(threadId);
    pending.delete(threadId);
    return value;
  },
};
