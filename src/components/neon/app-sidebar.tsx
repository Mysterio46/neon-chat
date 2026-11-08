import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import type { User } from "@supabase/supabase-js";
import { LogOutIcon, MessageSquareIcon, PanelLeftIcon, SearchIcon, Settings2Icon, SquarePenIcon, Trash2Icon, XIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { conversationsQuery, deleteConversation } from "@/lib/chat-data";
import { cn } from "@/lib/utils";

import { NeonLogo } from "./neon-logo";

export function displayName(user: User | null | undefined) {
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const name = (meta["display_name"] ?? meta["full_name"] ?? meta["name"]) as string | undefined;
  return name?.trim() || user?.email?.split("@")[0] || "You";
}

export function AppSidebar({
  user,
  collapsed,
  onToggle,
  onNavigate,
}: {
  user: User;
  collapsed: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { threadId?: string };
  const { data: conversations = [], isLoading } = useQuery(conversationsQuery());
  const [searching, setSearching] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? conversations.filter((c) => c.title.toLowerCase().includes(q)) : conversations;
  }, [conversations, search]);

  const remove = useMutation({
    mutationFn: deleteConversation,
    onSuccess: (_d, id) => {
      queryClient.setQueryData(conversationsQuery().queryKey, (old) => old?.filter((c) => c.id !== id));
      if (params.threadId === id) navigate({ to: "/chat" });
    },
    onError: () => toast.error("Couldn't delete that chat. Please try again."),
  });

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const name = displayName(user);

  if (collapsed) {
    return (
      <aside className="flex h-full w-[68px] shrink-0 flex-col items-center gap-2 bg-sidebar py-3 text-sidebar-foreground">
        <button
          type="button"
          onClick={onToggle}
          aria-label="Open sidebar"
          className="grid size-10 place-items-center rounded-full hover:bg-sidebar-accent"
        >
          <PanelLeftIcon className="size-5" />
        </button>
        <Link
          to="/chat"
          aria-label="New chat"
          className="grid size-10 place-items-center rounded-full hover:bg-sidebar-accent"
        >
          <SquarePenIcon className="size-5" />
        </Link>
        <div className="mt-auto grid size-9 place-items-center rounded-full bg-secondary text-sm font-semibold uppercase">
          {name.charAt(0)}
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex h-full w-[300px] shrink-0 flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2 px-4 pb-3 pt-4">
        <NeonLogo className="size-7" />
        <span className="text-[22px] font-semibold tracking-tight">Neon</span>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setSearching((s) => !s);
              setSearch("");
            }}
            aria-label="Search chats"
            className={cn(
              "grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground",
              searching && "bg-sidebar-accent text-sidebar-foreground",
            )}
          >
            <SearchIcon className="size-[18px]" />
          </button>
          <button
            type="button"
            onClick={onToggle}
            aria-label="Collapse sidebar"
            className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <PanelLeftIcon className="size-[18px]" />
          </button>
        </div>
      </div>

      <nav className="px-2">
        <Link
          to="/chat"
          onClick={onNavigate}
          activeOptions={{ exact: true }}
          className="flex items-center gap-3 rounded-full px-3 py-2.5 text-[15px] font-medium hover:bg-sidebar-accent data-[status=active]:bg-sidebar-accent"
        >
          <SquarePenIcon className="size-[18px]" />
          New chat
        </Link>
      </nav>

      {searching ? (
        <div className="mx-3 mt-3 flex items-center gap-2 rounded-full bg-sidebar-accent px-3 py-2">
          <SearchIcon className="size-4 text-muted-foreground" />
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search chats"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {search ? (
            <button type="button" aria-label="Clear search" onClick={() => setSearch("")}>
              <XIcon className="size-4 text-muted-foreground" />
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="mt-5 px-5 pb-2 text-xs font-medium text-muted-foreground">Recent</div>
      <div className="scrollbar-thin flex-1 overflow-y-auto px-2 pb-4">
        {isLoading ? (
          <div className="space-y-2 px-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-8 animate-pulse rounded-full bg-sidebar-accent/60" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-3 text-sm text-muted-foreground">{search ? "No chats match your search." : "Your chats will appear here."}</p>
        ) : (
          <ul className="space-y-0.5">
            {filtered.map((c) => {
              const active = params.threadId === c.id;
              return (
                <li key={c.id} className={cn("group flex items-center rounded-full hover:bg-sidebar-accent", active && "bg-sidebar-accent")}>
                  <Link
                    to="/chat/$threadId"
                    params={{ threadId: c.id }}
                    onClick={onNavigate}
                    className="flex min-w-0 flex-1 items-center gap-3 py-2 pl-3 pr-1 text-sm"
                  >
                    <MessageSquareIcon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{c.title}</span>
                  </Link>
                  <button
                    type="button"
                    aria-label={`Delete ${c.title}`}
                    onClick={() => remove.mutate(c.id)}
                    className="mr-1 grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground opacity-0 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <Trash2Icon className="size-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex items-center gap-3 border-t border-sidebar-border px-4 py-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-sm font-semibold uppercase">
          {name.charAt(0)}
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-[15px] font-medium">{name}</div>
          <div className="truncate text-xs text-muted-foreground">{user.email}</div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Settings"
            className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <Settings2Icon className="size-[18px]" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-56 rounded-xl">
            <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">{user.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={signOut} className="gap-2">
              <LogOutIcon className="size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
