import { useChat } from "@ai-sdk/react";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { DefaultChatTransport, type UIMessage } from "ai";
import { CheckIcon, CopyIcon, RefreshCwIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageAction, MessageActions, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/components/ai-elements/reasoning";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { NeonComposer } from "@/components/neon/neon-composer";
import { NeonLogo } from "@/components/neon/neon-logo";
import { useNeonModel } from "@/hooks/use-neon-model";
import { supabase } from "@/integrations/supabase/client";
import { conversationsQuery, pendingFirstMessage, threadQuery } from "@/lib/chat-data";
import { getNeonModel, type NeonModelId } from "@/lib/neon-models";

export const Route = createFileRoute("/_authenticated/chat/$threadId")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(threadQuery(params.threadId)),
  component: ThreadPage,
  pendingComponent: () => (
    <div className="flex flex-1 items-center justify-center">
      <Shimmer>Loading chat…</Shimmer>
    </div>
  ),
});

function ThreadPage() {
  const { threadId } = Route.useParams();
  const { data } = useSuspenseQuery(threadQuery(threadId));

  if (!data.conversation) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-medium">This chat doesn't exist</h1>
        <p className="text-muted-foreground">It may have been deleted.</p>
        <Link to="/chat" className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground">
          Start a new chat
        </Link>
      </div>
    );
  }

  return (
    <ChatWindow key={threadId} threadId={threadId} initialMessages={data.messages} initialModel={data.conversation.model} />
  );
}

function errorText(error: Error | undefined) {
  if (!error) return "";
  try {
    const parsed = JSON.parse(error.message) as { error?: string };
    if (parsed?.error) return parsed.error;
  } catch {
    // not JSON
  }
  return error.message || "Something went wrong. Please try again.";
}

function ChatWindow({
  threadId,
  initialMessages,
  initialModel,
}: {
  threadId: string;
  initialMessages: UIMessage[];
  initialModel: NeonModelId;
}) {
  const queryClient = useQueryClient();
  const [model, setModel] = useNeonModel(initialModel);
  const modelRef = useRef(model);
  modelRef.current = model;

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        headers: async (): Promise<Record<string, string>> => {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
        body: () => ({ conversationId: threadId, model: modelRef.current }),
      }),
    [threadId],
  );

  const { messages, sendMessage, status, stop, error, regenerate } = useChat({
    id: threadId,
    messages: initialMessages,
    transport,
    onError: (e) => toast.error(errorText(e)),
    onFinish: () => {
      void queryClient.invalidateQueries({ queryKey: conversationsQuery().queryKey });
    },
  });

  useEffect(() => {
    // Deferred so a mount that is immediately torn down (which stops the chat)
    // doesn't swallow the first question; the surviving mount sends it.
    const timer = setTimeout(() => {
      const pending = pendingFirstMessage.take(threadId);
      if (pending) {
        setModel(pending.model);
        modelRef.current = pending.model;
        void sendMessage({ text: pending.text });
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [threadId, sendMessage, setModel]);

  const busy = status === "submitted" || status === "streaming";
  const last = messages.at(-1);
  const waiting =
    busy && (last?.role === "user" || !last?.parts.some((p) => p.type === "text" && p.text.length > 0));

  return (
    <div className="neon-canvas flex min-h-0 flex-1 flex-col" data-active="true">
      <Conversation className="scrollbar-thin min-h-0 flex-1">
        <ConversationContent className="mx-auto w-full max-w-[820px] gap-8 px-4 pb-10 pt-8 md:px-6">
          {messages.map((message, index) => (
            <ChatMessage
              key={message.id}
              message={message}
              streaming={busy && index === messages.length - 1}
              isLast={index === messages.length - 1}
              onRetry={status === "ready" || status === "error" ? () => void regenerate() : undefined}
            />
          ))}
          {waiting ? (
            <div className="flex items-center gap-3">
              <NeonLogo className="size-7 animate-pulse" />
              <Shimmer className="text-[15px]">{`${getNeonModel(model).label} is thinking…`}</Shimmer>
            </div>
          ) : null}
          {status === "error" && error ? (
            <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-foreground">
              {errorText(error)}
            </div>
          ) : null}
        </ConversationContent>
        <ConversationScrollButton className="bottom-6" />
      </Conversation>
      <div className="mx-auto w-full max-w-[860px] px-4 pb-4">
        <NeonComposer
          onSend={(text) => void sendMessage({ text })}
          status={status}
          onStop={stop}
          model={model}
          onModelChange={setModel}
        />
        <p className="mt-2 text-center text-xs text-muted-foreground">Neon can make mistakes, so double-check important info.</p>
      </div>
    </div>
  );
}

function ChatMessage({
  message,
  streaming,
  isLast,
  onRetry,
}: {
  message: UIMessage;
  streaming: boolean;
  isLast: boolean;
  onRetry?: (() => void) | undefined;
}) {
  const [copied, setCopied] = useState(false);
  const text = message.parts
    .filter((p) => p.type === "text")
    .map((p) => (p.type === "text" ? p.text : ""))
    .join("\n\n");
  const meta = (message.metadata ?? {}) as { model?: string };

  if (message.role === "user") {
    return (
      <Message from="user" className="max-w-[85%]">
        <MessageContent className="group-[.is-user]:rounded-3xl group-[.is-user]:rounded-br-lg group-[.is-user]:bg-bubble group-[.is-user]:px-5 group-[.is-user]:text-[15px] group-[.is-user]:text-bubble-foreground">
          <p className="whitespace-pre-wrap">{text}</p>
        </MessageContent>
      </Message>
    );
  }

  const hasText = text.trim().length > 0;

  return (
    <Message from="assistant" className="max-w-full">
      <div className="flex gap-4">
        <NeonLogo className="mt-0.5 size-7 shrink-0" />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {message.parts.map((part, i) => {
            if (part.type === "reasoning" && part.text.trim()) {
              const partStreaming = streaming && i === message.parts.length - 1;
              return (
                <Reasoning key={i} isStreaming={partStreaming} defaultOpen={false}>
                  <ReasoningTrigger />
                  <ReasoningContent>{part.text}</ReasoningContent>
                </Reasoning>
              );
            }
            if (part.type === "text") {
              return (
                <MessageContent key={i} className="w-full text-[15.5px] leading-7">
                  <MessageResponse isAnimating={streaming}>{part.text}</MessageResponse>
                </MessageContent>
              );
            }
            return null;
          })}
          {hasText && !streaming ? (
            <MessageActions className="-ml-2 opacity-70 transition-opacity group-hover:opacity-100">
              <MessageAction
                tooltip={copied ? "Copied" : "Copy"}
                onClick={async () => {
                  await navigator.clipboard.writeText(text);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
              </MessageAction>
              {isLast && onRetry ? (
                <MessageAction tooltip="Regenerate" onClick={onRetry}>
                  <RefreshCwIcon className="size-4" />
                </MessageAction>
              ) : null}
              {meta.model ? (
                <span className="ml-1 text-xs text-muted-foreground">{getNeonModel(meta.model).label}</span>
              ) : null}
            </MessageActions>
          ) : null}
        </div>
      </div>
    </Message>
  );
}
