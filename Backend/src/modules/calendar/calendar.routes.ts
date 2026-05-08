import { Router } from "express";
import * as ctl from "./calendar.controller.js";
import { requireAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import {
  CreateCalendarEventBody,
  MeetingNoteBody,
  UpdateCalendarEventBody,
} from "./calendar.schema.js";

export const calendarRouter = Router();

calendarRouter.use(requireAuth);

calendarRouter.get("/", ctl.getList);
calendarRouter.post("/", validate(CreateCalendarEventBody), ctl.postCreate);
// Note routes that don't carry an event id come before the dynamic `:id`
// routes so Express doesn't snap "notes" up as an ObjectId.
calendarRouter.patch(
  "/notes/:noteId",
  validate(MeetingNoteBody),
  ctl.patchNote,
);
calendarRouter.delete("/notes/:noteId", ctl.deleteNoteCtl);
calendarRouter.get("/:id", ctl.getOne);
calendarRouter.patch("/:id", validate(UpdateCalendarEventBody), ctl.patchOne);
calendarRouter.delete("/:id", ctl.deleteOne);
calendarRouter.get("/:id/notes", ctl.getNotes);
calendarRouter.post("/:id/notes", validate(MeetingNoteBody), ctl.postNote);
