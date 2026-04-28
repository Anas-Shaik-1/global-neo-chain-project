import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppSelector } from "@/app/hooks";
import {
  chatKeys,
  useConversations,
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
} from "../socket";
import { ConversationList } from "../components/ConversationList";
import { MessageThread } from "../components/MessageThread";
import { NewConversationDialog } from "../components/NewConversationDialog";

export function MessagesPage() {
  const me = useAppSelector((s) => s.auth.user);
  const token = useAppSelector((s) => s.auth.accessToken);
  const qc = useQueryClient();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  const conversations = useConversations();
  const messages = useMessages(selectedId ?? undefined, { limit: 50 });
  const send = useSendMessage();

  const selected = useMemo(
    () => (conversations.data ?? []).find((c) => c.id === selectedId) ?? null,
    [conversations.data, selectedId],
  );

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
    return () => {
      disconnectChatSocket();
    };
  }, [token]);

  // Join/leave the selected conversation room and stream incoming messages.
  useEffect(() => {
    if (!selectedId) return;
    joinConversation(selectedId);
    const off = onMessage((msg: ChatMessage) => {
      if (msg.conversationId !== selectedId) return;
      qc.setQueryData(
        chatKeys.messages(selectedId, { limit: 50 }),
        (old: ChatMessage[] | undefined) => {
          if (!old) return [msg];
          if (old.some((m) => m.id === msg.id)) return old;
          // newest-first list
          return [msg, ...old];
        },
      );
      qc.invalidateQueries({ queryKey: chatKeys.conversations });
    });
    return () => {
      off();
      leaveConversation(selectedId);
    };
  }, [selectedId, qc]);

  async function handleSend(body: string) {
    if (!selectedId) return;
    await send.mutateAsync({ conversationId: selectedId, body });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Messages</h1>
      </div>

      <div className="grid h-[calc(100vh-12rem)] grid-cols-1 overflow-hidden rounded-lg border border-border bg-card md:grid-cols-[20rem_1fr]">
        <aside className="flex flex-col border-b border-border md:border-b-0 md:border-r">
          <div className="border-b border-border p-3">
            <Button className="w-full" onClick={() => setShowNew(true)}>
              + New conversation
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversations.isLoading ? (
              <div className="space-y-2 p-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : (
              <ConversationList
                conversations={conversations.data ?? []}
                meId={me?.id}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            )}
          </div>
        </aside>

        <section className="flex min-h-[400px] flex-col">
          {selected ? (
            <MessageThread
              conversation={selected}
              meId={me?.id}
              messages={messages.data ?? []}
              isLoading={messages.isLoading}
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
    </div>
  );
}
