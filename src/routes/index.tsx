import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { NeonLogo } from "@/components/neon/neon-logo";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Neon — Your AI assistant" },
      { name: "description", content: "Chat with Neon: choose Neon-Lite for quick answers, Neon 3.1 for quick detail, or Neon 7.3 for in-depth responses." },
      { property: "og:title", content: "Neon — Your AI assistant" },
      { property: "og:description", content: "Chat with Neon in three speeds: Neon-Lite, Neon 3.1 and Neon 7.3." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      navigate({ to: data.user ? "/chat" : "/auth", replace: true });
    });
  }, [navigate]);

  return (
    <div className="neon-canvas flex min-h-dvh items-center justify-center">
      <NeonLogo className="size-14 animate-pulse" />
    </div>
  );
}
