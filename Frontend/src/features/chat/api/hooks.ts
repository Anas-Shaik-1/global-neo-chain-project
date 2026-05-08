import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { getApi } from "@/api/axios";

const api = () => getApi();

function errorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    return (err.response?.data as { message?: string } | undefined)?.message ?? fallback;
  }
  return fallback;
}

export type ConversationKind = "DM" | "GROUP";

export interface ChatParticipant {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface Conversation {
  id: string;
  kind: ConversationKind;
  name: string | null;
  createdById: string | null;
  participants: ChatParticipant[];
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  authorId: string;
  authorName: string | null;
  body: string;
  createdAt: string;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  attachmentMimeType?: string | null;
  attachmentSize?: number | null;
}

export const chatKeys = {
  all: ["chat"] as const,
  conversations: ["chat", "conversations"] as const,
  unreadTotal: ["chat", "unread-total"] as const,
  messages: (id: string, params: Record<string, unknown> = {}) =>
    ["chat", "messages", id, params] as const,
};

export function useConversations() {
  return useQuery({
    queryKey: chatKeys.conversations,
    queryFn: async () => {
      const res = await api().get("/chat/conversations");
      return res.data as Conversation[];
    },
  });
}

/**
 * Total unread chat messages across every conversation the user is in.
 * Drives the badge on the main sidebar's "Messages" entry. Polls every
 * 30s as a safety net; the chat socket also nudges this query (see
 * MessagesPage / AppLayout) when a new message lands.
 */
export function useChatUnreadTotal() {
  return useQuery({
    queryKey: chatKeys.unreadTotal,
    queryFn: async () => {
      const res = await api().get("/chat/me/unread-count");
      return res.data as { count: number };
    },
    refetchInterval: 30_000,
  });
}

/**
 * Mark a conversation as read up to "now". Idempotent; safe to fire on
 * every open. On success we invalidate both the conversation list (so the
 * per-row badge clears) and the unread total (so the sidebar badge clears).
 */
export function useMarkConversationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (conversationId: string) => {
      await api().post(`/chat/conversations/${conversationId}/read`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chatKeys.conversations });
      qc.invalidateQueries({ queryKey: chatKeys.unreadTotal });
    },
  });
}

export function useOpenConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (otherUserId: string) => {
      const res = await api().post("/chat/conversations", { otherUserId });
      return res.data as Conversation;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chatKeys.conversations });
      toast.success("Conversation opened");
    },
    onError: (err) => toast.error(errorMessage(err, "Could not open conversation")),
  });
}

export interface CreateGroupInput {
  name: string;
  participantIds: string[];
}

export function useCreateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateGroupInput) => {
      const res = await api().post("/chat/groups", input);
      return res.data as Conversation;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chatKeys.conversations });
      toast.success("Group created");
    },
    onError: (err) => toast.error(errorMessage(err, "Could not create group")),
  });
}

export function useAddGroupMember(conversationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      if (!conversationId) throw new Error("No conversation selected");
      const res = await api().post(
        `/chat/conversations/${conversationId}/members`,
        { userId },
      );
      return res.data as Conversation;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chatKeys.conversations });
      toast.success("Member added");
    },
    onError: (err) => toast.error(errorMessage(err, "Could not add member")),
  });
}

export function useRemoveGroupMember(conversationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      if (!conversationId) throw new Error("No conversation selected");
      const res = await api().delete(
        `/chat/conversations/${conversationId}/members/${userId}`,
      );
      return res.data as Conversation;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chatKeys.conversations });
    },
    onError: (err) => toast.error(errorMessage(err, "Could not remove member")),
  });
}

export interface ListMessagesParams {
  /**
   * Page size for both the initial load and each "older" page fetched on
   * scroll-up. The backend caps this at 100; we default to 50 which gives
   * a smooth scroll without flooding the wire.
   */
  limit?: number;
}

/**
 * Cursor-paginated message stream. The backend supports
 * `?before=<ISO>&limit=N` and returns the latest N messages older than the
 * cursor (newest-first). React Query's infinite-query primitive walks the
 * pages backwards through history as the user scrolls toward the top of
 * the thread.
 *
 * Pages are returned newest-first; consumers `flat()` them and reverse for
 * oldest-at-top render. `getNextPageParam` returns the createdAt of the
 * oldest message in the latest page, or `undefined` when the page came
 * back smaller than `limit` (no more history).
 */
export function useMessages(
  conversationId: string | undefined,
  params: ListMessagesParams = {},
) {
  const limit = params.limit ?? 50;
  return useInfiniteQuery({
    queryKey: chatKeys.messages(conversationId ?? "", { limit } as Record<string, unknown>),
    enabled: !!conversationId,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const res = await api().get(
        `/chat/conversations/${conversationId}/messages`,
        {
          params: pageParam
            ? { before: pageParam, limit }
            : { limit },
        },
      );
      return res.data as ChatMessage[];
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage || lastPage.length < limit) return undefined;
      const oldest = lastPage[lastPage.length - 1];
      return oldest?.createdAt;
    },
  });
}

export interface SendMessageInput {
  conversationId: string;
  body?: string;
  file?: File;
}

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ conversationId, body, file }: SendMessageInput) => {
      if (file) {
        const fd = new FormData();
        fd.append("file", file);
        if (body && body.length > 0) fd.append("body", body);
        const res = await api().post(
          `/chat/conversations/${conversationId}/messages/attachment`,
          fd,
          { headers: { "Content-Type": "multipart/form-data" } },
        );
        return res.data as ChatMessage;
      }
      const res = await api().post(
        `/chat/conversations/${conversationId}/messages`,
        { body: body ?? "" },
      );
      return res.data as ChatMessage;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: chatKeys.conversations });
      qc.invalidateQueries({
        queryKey: ["chat", "messages", vars.conversationId],
      });
      // Intentionally no success toast — would be too noisy on every send.
    },
    onError: (err) => toast.error(errorMessage(err, "Could not send message")),
  });
}
