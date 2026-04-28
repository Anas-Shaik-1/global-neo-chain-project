import { Router } from "express";
import * as ctl from "./expenses.controller.js";
import { validate } from "../../middleware/validate.js";
import { requireAuth } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/requireRole.js";
import { uploadReceipt } from "../../middleware/upload.js";
import { CreateExpenseBody, DecideExpenseBody } from "./expenses.schema.js";

export const expensesRouter = Router();

expensesRouter.use(requireAuth);

expensesRouter.get("/me", ctl.getMyList);
expensesRouter.get("/", requireRole("HR", "ADMIN"), ctl.getAllList);
expensesRouter.post("/", validate(CreateExpenseBody), ctl.postCreate);
expensesRouter.get("/:id", ctl.getOne);
expensesRouter.post("/:id/receipt", uploadReceipt, ctl.postReceipt);
expensesRouter.delete("/:id/receipt", ctl.deleteReceipt);
expensesRouter.post(
  "/:id/decide",
  requireRole("HR", "ADMIN"),
  validate(DecideExpenseBody),
  ctl.postDecide,
);
