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
