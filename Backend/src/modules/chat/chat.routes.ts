import { Router } from "express";
import * as ctl from "./chat.controller.js";
import { validate } from "../../middleware/validate.js";
import { requireAuth } from "../../middleware/auth.js";
import { uploadChatAttachment } from "../../middleware/upload.js";
import {
  AddGroupMemberBody,
  CreateGroupBody,
  OpenConversationBody,
  SendMessageBody,
} from "./chat.schema.js";

export const chatRouter = Router();

chatRouter.use(requireAuth);

chatRouter.get("/conversations", ctl.getConversations);
chatRouter.get("/me/unread-count", ctl.getUnreadTotal);
chatRouter.post(
  "/conversations",
  validate(OpenConversationBody),
  ctl.postOpenConversation,
);
chatRouter.post("/conversations/:id/read", ctl.postMarkConversationRead);
chatRouter.get("/conversations/:id/messages", ctl.getMessages);
chatRouter.post(
  "/conversations/:id/messages",
  validate(SendMessageBody),
  ctl.postMessage,
);
chatRouter.post(
  "/conversations/:id/messages/attachment",
  uploadChatAttachment,
  ctl.postMessageWithAttachment,
);

// Group conversation management.
chatRouter.post("/groups", validate(CreateGroupBody), ctl.postCreateGroup);
chatRouter.post(
  "/conversations/:id/members",
  validate(AddGroupMemberBody),
  ctl.postAddGroupMember,
);
chatRouter.delete(
  "/conversations/:id/members/:userId",
  ctl.deleteGroupMember,
);
