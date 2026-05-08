import { z } from "zod";

const optionalProjectId = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "Invalid project id")
  .optional()
  .or(z.literal(""));

export const ReportBugSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Title must be at least 3 characters")
    .max(200, "Title must be 200 characters or fewer"),
  description: z
    .string()
    .trim()
    .min(1, "Description is required")
    .max(5000, "Description must be 5000 characters or fewer"),
  projectId: optionalProjectId,
});
export type ReportBugValues = z.infer<typeof ReportBugSchema>;

export const EditBugSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Title must be at least 3 characters")
    .max(200, "Title must be 200 characters or fewer"),
  description: z
    .string()
    .trim()
    .min(1, "Description is required")
    .max(5000, "Description must be 5000 characters or fewer"),
  status: z.enum(["OPEN", "IN_PROGRESS", "FIXED", "WONT_FIX"]),
  projectId: optionalProjectId,
});
export type EditBugValues = z.infer<typeof EditBugSchema>;
