import { Router } from "express";
import * as ctl from "./notifications.controller.js";
import { requireAuth } from "../../middleware/auth.js";

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);

notificationsRouter.get("/me", ctl.getMine);
notificationsRouter.get("/me/unread-count", ctl.getUnreadCount);
notificationsRouter.post("/me/read-all", ctl.postMarkAllRead);
notificationsRouter.post("/me/:id/read", ctl.postMarkRead);
