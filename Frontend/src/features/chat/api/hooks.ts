import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

export interface ChatParticipant {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface Conversation {
  id: string;
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
}

export const chatKeys = {
  all: ["chat"] as const,
  conversations: ["chat", "conversations"] as const,
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

export interface ListMessagesParams {
  before?: string;
  limit?: number;
}

export function useMessages(
  conversationId: string | undefined,
  params: ListMessagesParams = {},
) {
  return useQuery({
    queryKey: chatKeys.messages(conversationId ?? "", params as Record<string, unknown>),
    enabled: !!conversationId,
    queryFn: async () => {
      const res = await api().get(
        `/chat/conversations/${conversationId}/messages`,
        { params },
      );
      return res.data as ChatMessage[];
    },
  });
}

export interface SendMessageInput {
  conversationId: string;
  body: string;
}

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ conversationId, body }: SendMessageInput) => {
      const res = await api().post(
        `/chat/conversations/${conversationId}/messages`,
        { body },
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
