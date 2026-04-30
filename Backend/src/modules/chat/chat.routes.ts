import { Router } from "express";
import * as ctl from "./chat.controller.js";
import { validate } from "../../middleware/validate.js";
import { requireAuth } from "../../middleware/auth.js";
import { uploadChatAttachment } from "../../middleware/upload.js";
import { OpenConversationBody, SendMessageBody } from "./chat.schema.js";

export const chatRouter = Router();

chatRouter.use(requireAuth);

chatRouter.get("/conversations", ctl.getConversations);
chatRouter.post(
  "/conversations",
  validate(OpenConversationBody),
  ctl.postOpenConversation,
);
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
