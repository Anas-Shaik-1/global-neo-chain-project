import { z } from "zod";

// Building blocks ---------------------------------------------------------

export const nameSchema = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(100, "Name must be 100 characters or fewer");

/**
 * Optional phone — accepts empty string (cleanest with RHF defaults) or a
 * 10-digit Indian mobile. The backend stores the canonical `+91XXXXXXXXXX`
 * E.164 form; the UI always works with the bare 10-digit subscriber part.
 */
export const phoneOptionalSchema = z
  .string()
  .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number")
  .or(z.literal(""))
  .optional();

export const bioOptionalSchema = z
  .string()
  .max(500, "Bio must be 500 characters or fewer")
  .or(z.literal(""))
  .optional();

export const departmentCodeSchema = z
  .string()
  .min(1, "Code is required")
  .max(30, "Code must be 30 characters or fewer")
  .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, and hyphens only");

// Concrete form schemas ----------------------------------------------------

// Note: the legacy CreateEmployeeSchema was removed when the
// self-registration + 2-stage approval pipeline replaced HR-creates-employee.
// New users go through `RegisterSchema` in features/auth/schemas.

export const ProfileEditSchema = z.object({
  name: nameSchema,
  phone: phoneOptionalSchema,
  bio: bioOptionalSchema,
});
export type ProfileEditValues = z.infer<typeof ProfileEditSchema>;

export const CreateDepartmentSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(100, "Name must be 100 characters or fewer"),
  code: departmentCodeSchema,
});
export type CreateDepartmentValues = z.infer<typeof CreateDepartmentSchema>;

export const UpdateDepartmentSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(100, "Name must be 100 characters or fewer"),
  code: departmentCodeSchema,
  description: z
    .string()
    .max(500, "Description must be 500 characters or fewer")
    .or(z.literal(""))
    .optional(),
  managerId: z.string().or(z.literal("")).optional(),
});
export type UpdateDepartmentValues = z.infer<typeof UpdateDepartmentSchema>;
