import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/common/PageHeader";
import { PageContainer } from "@/components/common/PageContainer";
import { SearchBar } from "@/components/common/SearchBar";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import {
  chatKeys,
  useConversations,
  useMarkConversationRead,
  useMessages,
  useSendMessage,
  type ChatMessage,
} from "../api/hooks";
import {
  connectChatSocket,
  disconnectChatSocket,
  joinConversation,
  leaveConversation,
  onMessage,
  onPresence,
} from "../socket";
import {
  presenceCleared,
  presenceOffline,
  presenceOnline,
  presenceSnapshot,
} from "../presenceSlice";
import { ConversationList } from "../components/ConversationList";
import { MessageThread } from "../components/MessageThread";
import { NewConversationDialog } from "../components/NewConversationDialog";

export function MessagesPage() {
  const me = useAppSelector((s) => s.auth.user);
  const token = useAppSelector((s) => s.auth.accessToken);
  const dispatch = useAppDispatch();
  const qc = useQueryClient();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState("");
  // Collapsible inner sidebar: when collapsed (lg+ only) the conversation
  // panel narrows to an avatar-rail; on mobile the layout is already stacked
  // and the toggle has no effect.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const conversations = useConversations();
  const messages = useMessages(selectedId ?? undefined, { limit: 50 });
  const send = useSendMessage();
  const markRead = useMarkConversationRead();
  // Flatten infinite-query pages into a single newest-first list. Each page
  // is already newest-first; concat preserves ordering across pages because
  // older pages are fetched after newer ones.
  const flatMessages = useMemo(
    () => (messages.data?.pages ?? []).flat(),
    [messages.data],
  );

  const selected = useMemo(
    () => (conversations.data ?? []).find((c) => c.id === selectedId) ?? null,
    [conversations.data, selectedId],
  );

  const filteredConversations = useMemo(() => {
    const all = conversations.data ?? [];
    const t = search.trim().toLowerCase();
    if (!t) return all;
    return all.filter((c) => {
      if (c.kind === "GROUP") {
        return (c.name ?? "").toLowerCase().includes(t);
      }
      const other = c.participants.find((p) => p.id !== me?.id) ?? c.participants[0];
      return (other?.name ?? "").toLowerCase().includes(t);
    });
  }, [conversations.data, search, me?.id]);

  // Auto-select the first conversation once loaded.
  useEffect(() => {
    if (selectedId) return;
    const first = conversations.data?.[0];
    if (first) setSelectedId(first.id);
  }, [conversations.data, selectedId]);

  // Socket lifecycle: connect once per token, disconnect on unmount.
  useEffect(() => {
    if (!token) return;
    connectChatSocket(token);
    // Subscribe to presence events. The server pushes a `snapshot` on
    // connect with everyone who's currently online, then per-user `online`
    // / `offline` deltas as people come and go.
    const off = onPresence({
      snapshot: ({ userIds }) => dispatch(presenceSnapshot({ userIds })),
      online: ({ userId }) => dispatch(presenceOnline({ userId })),
      offline: ({ userId }) => dispatch(presenceOffline({ userId })),
    });
    return () => {
      off();
      disconnectChatSocket();
      dispatch(presenceCleared());
    };
  }, [token, dispatch]);

  // Join/leave the selected conversation room and stream incoming messages.
  useEffect(() => {
    if (!selectedId) return;
    joinConversation(selectedId);
    // Mark the conversation as read on open so the per-row badge clears
    // and the sidebar total drops accordingly. Best-effort — failures are
    // surfaced as toasts inside the hook (currently silent).
    markRead.mutate(selectedId);
    const off = onMessage((msg: ChatMessage) => {
      if (msg.conversationId !== selectedId) return;
      // Realtime arrival: prepend the new message to the *first* page of the
      // infinite query so it surfaces at the bottom of the rendered thread
      // (which reverses to oldest-first). Older pages stay untouched so
      // pagination state is preserved.
      qc.setQueryData<{ pages: ChatMessage[][]; pageParams: unknown[] }>(
        chatKeys.messages(selectedId, { limit: 50 }),
        (old) => {
          if (!old) {
            return { pages: [[msg]], pageParams: [undefined] };
          }
          const firstPage = old.pages[0] ?? [];
          if (firstPage.some((m) => m.id === msg.id)) return old;
          return {
            ...old,
            pages: [[msg, ...firstPage], ...old.pages.slice(1)],
          };
        },
      );
      qc.invalidateQueries({ queryKey: chatKeys.conversations });
      qc.invalidateQueries({ queryKey: chatKeys.unreadTotal });
      // The user is actively viewing this conversation; bump the read marker
      // again so the new arrival doesn't immediately count as unread.
      markRead.mutate(selectedId);
    });
    return () => {
      off();
      leaveConversation(selectedId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, qc]);

  async function handleSend(body: string, file?: File) {
    if (!selectedId) return;
    await send.mutateAsync({ conversationId: selectedId, body, file });
  }

  return (
    <PageContainer width="full" className="space-y-6">
      <PageHeader
        title="Messages"
        description="Direct conversations with your colleagues."
      />

      <div
        className={cn(
          "grid h-[calc(100vh-16rem)] grid-cols-1 overflow-hidden rounded-lg border border-border bg-card",
          sidebarCollapsed ? "md:grid-cols-[56px_1fr]" : "md:grid-cols-[20rem_1fr]",
        )}
      >
        <aside className="flex flex-col border-b border-border md:border-b-0 md:border-r">
          <div
            className={cn(
              "flex shrink-0 items-center border-b border-border",
              sidebarCollapsed ? "h-14 justify-center px-1" : "gap-2 p-3",
            )}
          >
            {sidebarCollapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setShowNew(true)}
                    aria-label="New conversation"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="font-medium">
                  New conversation
                </TooltipContent>
              </Tooltip>
            ) : (
              <div className="flex-1 space-y-3">
                <div className="flex items-center justify-between px-0.5">
                  <span className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Conversations
                  </span>
                  {(conversations.data?.length ?? 0) > 0 && (
                    <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] font-semibold tabular-nums text-muted-foreground">
                      {conversations.data?.length}
                    </span>
                  )}
                </div>
                <Button className="w-full" onClick={() => setShowNew(true)}>
                  + New conversation
                </Button>
                <SearchBar
                  value={search}
                  onChange={setSearch}
                  placeholder="Search conversations…"
                  ariaLabel="Search conversations"
                />
              </div>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversations.isLoading ? (
              <div className="space-y-2 p-3">
                <Skeleton className={sidebarCollapsed ? "h-10 w-10" : "h-12 w-full"} />
                <Skeleton className={sidebarCollapsed ? "h-10 w-10" : "h-12 w-full"} />
                <Skeleton className={sidebarCollapsed ? "h-10 w-10" : "h-12 w-full"} />
              </div>
            ) : (
              <ConversationList
                conversations={filteredConversations}
                meId={me?.id}
                selectedId={selectedId}
                onSelect={setSelectedId}
                collapsed={sidebarCollapsed}
              />
            )}
          </div>
          {/* Collapse / expand toggle — pinned to the bottom of the sidebar
              like Slack/Linear so the control's position is predictable in
              both states. Only renders on md+ (mobile is already full
              width). The label switches with state and the chevron rotates
              to mirror the action. */}
          <div className="hidden shrink-0 border-t border-border/60 p-2 md:block">
            <button
              type="button"
              onClick={() => setSidebarCollapsed((v) => !v)}
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              className={cn(
                "group flex h-8 items-center rounded-md text-xs font-medium text-muted-foreground outline-none transition-colors",
                "hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary",
                sidebarCollapsed
                  ? "mx-auto w-8 justify-center"
                  : "w-full justify-between px-2.5",
              )}
            >
              {!sidebarCollapsed && <span>Hide sidebar</span>}
              <ChevronLeft
                className={cn(
                  "h-4 w-4 shrink-0 transition-transform duration-150",
                  sidebarCollapsed && "rotate-180",
                  !sidebarCollapsed && "group-hover:-translate-x-0.5",
                )}
              />
            </button>
          </div>
        </aside>

        <section className="flex min-h-[400px] flex-col">
          {selected ? (
            <MessageThread
              conversation={selected}
              meId={me?.id}
              messages={flatMessages}
              isLoading={messages.isLoading}
              hasMore={Boolean(messages.hasNextPage)}
              isLoadingMore={Boolean(messages.isFetchingNextPage)}
              onLoadMore={() => {
                if (messages.hasNextPage && !messages.isFetchingNextPage) {
                  void messages.fetchNextPage();
                }
              }}
              onSend={handleSend}
              isSending={send.isPending}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center px-6 py-10 text-center text-sm text-muted-foreground">
              {conversations.isLoading
                ? "Loading conversations..."
                : "Select a conversation or start a new one."}
            </div>
          )}
        </section>
      </div>

      <NewConversationDialog
        open={showNew}
        onOpenChange={setShowNew}
        meId={me?.id}
        onOpened={(id) => setSelectedId(id)}
      />
    </PageContainer>
  );
}
