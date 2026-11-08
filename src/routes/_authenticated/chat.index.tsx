import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { displayName } from "@/components/neon/app-sidebar";
import { NeonComposer } from "@/components/neon/neon-composer";
import { useNeonModel } from "@/hooks/use-neon-model";
import { pendingFirstMessage, startLocalConversation } from "@/lib/chat-data";

export const Route = createFileRoute("/_authenticated/chat/")({
  component: NewChat,
});

function NewChat() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [model, setModel] = useNeonModel();
  const [creating, setCreating] = useState(false);
  const firstName = displayName(user).split(" ")[0];

  const start = async (text: string) => {
    if (creating) return;
    setCreating(true);
    try {
      const id = startLocalConversation(queryClient, model, text);
      pendingFirstMessage.set(id, { text, model });
      await navigate({ to: "/chat/$threadId", params: { threadId: id } });
    } catch (e) {
      console.error(e);
      toast.error("Couldn't start a new chat. Please try again.");
      setCreating(false);
    }
  };

  return (
    <div className="neon-canvas flex flex-1 flex-col items-center justify-center px-4 pb-16">
      <div className="w-full max-w-[860px] animate-in fade-in slide-in-from-bottom-2 duration-500">
        <p className="mb-3 text-center text-lg text-muted-foreground">
          Hi <span className="neon-text font-semibold">{firstName}</span>
        </p>
        <h1 className="mb-10 text-center text-4xl font-normal tracking-tight text-foreground md:text-[52px] md:leading-tight">
          Where should we start?
        </h1>
        <NeonComposer
          onSend={start}
          status={creating ? "submitted" : "ready"}
          model={model}
          onModelChange={setModel}
        />
      </div>
    </div>
  );
}
