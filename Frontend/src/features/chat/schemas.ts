import { z } from "zod";

/** New conversation dialog: just a search input. */
export const NewConversationSearchSchema = z.object({
  query: z.string().max(120, "Keep it under 120 characters"),
});
export type NewConversationSearchValues = z.infer<typeof NewConversationSearchSchema>;

/** Chat composer in MessageThread. */
export const ChatMessageSchema = z.object({
  body: z
    .string()
    .min(1, "Message can't be empty")
    .max(4000, "Message must be 4000 characters or fewer"),
});
export type ChatMessageValues = z.infer<typeof ChatMessageSchema>;
