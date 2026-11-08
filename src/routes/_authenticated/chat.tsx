import { createFileRoute, Outlet } from "@tanstack/react-router";
import { MenuIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { AppSidebar } from "@/components/neon/app-sidebar";
import { NeonLogo } from "@/components/neon/neon-logo";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({
    meta: [
      { title: "Neon — Chat" },
      { name: "description", content: "Chat with Neon, your AI assistant with three models: Neon-Lite, Neon 3.1 and Neon 7.3." },
      { property: "og:title", content: "Neon — Chat" },
      { property: "og:description", content: "Chat with Neon, your AI assistant with three models." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChatLayout,
});

function ChatLayout() {
  const { user } = Route.useRouteContext();
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!isMobile) setMobileOpen(false);
  }, [isMobile]);

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background">
      {isMobile ? (
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-[300px] border-0 bg-sidebar p-0 [&>button]:hidden">
            <SheetTitle className="sr-only">Chats</SheetTitle>
            <AppSidebar user={user} collapsed={false} onToggle={() => setMobileOpen(false)} onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>
      ) : (
        <AppSidebar user={user} collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      )}

      <main className="relative flex min-w-0 flex-1 flex-col">
        {isMobile ? (
          <header className="flex items-center gap-2 px-3 py-2">
            <button
              type="button"
              aria-label="Open chats"
              onClick={() => setMobileOpen(true)}
              className="grid size-10 place-items-center rounded-full hover:bg-accent"
            >
              <MenuIcon className="size-5" />
            </button>
            <NeonLogo className="size-6" />
            <span className="text-lg font-semibold">Neon</span>
          </header>
        ) : null}
        <Outlet />
      </main>
    </div>
  );
}
