import { z } from "zod";

const objectIdRegex = /^[a-f\d]{24}$/i;

const objectIdOrEmpty = z
  .string()
  .regex(objectIdRegex, "Invalid id")
  .or(z.literal(""))
  .optional();

export const taskTitleSchema = z
  .string()
  .trim()
  .min(1, "Title is required")
  .max(200, "Title must be 200 characters or fewer");

export const taskDescriptionSchema = z
  .string()
  .max(5000, "Description must be 5000 characters or fewer")
  .or(z.literal(""))
  .optional();

const projectKeySchema = z
  .string()
  .min(1, "Key is required")
  .max(30, "Key must be 30 characters or fewer")
  .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, and hyphens only");

export const CreateProjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(100, "Name must be 100 characters or fewer"),
  key: projectKeySchema,
  description: z
    .string()
    .max(500, "Description must be 500 characters or fewer")
    .or(z.literal(""))
    .optional(),
});
export type CreateProjectValues = z.infer<typeof CreateProjectSchema>;

export const CreateTaskSchema = z.object({
  title: taskTitleSchema,
  description: taskDescriptionSchema,
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
  assigneeId: objectIdOrEmpty,
  dueDate: z
    .string()
    // Allow blank (no due date) or a parseable ISO yyyy-mm-dd date.
    .refine(
      (v) => v === "" || !Number.isNaN(new Date(v).getTime()),
      "Pick a valid date",
    )
    .optional(),
});
export type CreateTaskValues = z.infer<typeof CreateTaskSchema>;

export const UpdateTaskSchema = z.object({
  title: taskTitleSchema,
  description: taskDescriptionSchema,
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
  assigneeId: objectIdOrEmpty,
  dueDate: z
    .string()
    .refine(
      (v) => v === "" || !Number.isNaN(new Date(v).getTime()),
      "Pick a valid date",
    )
    .optional(),
});
export type UpdateTaskValues = z.infer<typeof UpdateTaskSchema>;

export const AddCommentSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Comment can't be empty")
    .max(2000, "Comment must be 2000 characters or fewer"),
});
export type AddCommentValues = z.infer<typeof AddCommentSchema>;

export const AddSubtaskSchema = z.object({
  title: taskTitleSchema,
});
export type AddSubtaskValues = z.infer<typeof AddSubtaskSchema>;
