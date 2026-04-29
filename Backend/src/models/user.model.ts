import { Schema, model, type InferSchemaType, type Model, Types } from "mongoose";

export const ROLES = ["ADMIN", "HR", "EMPLOYEE"] as const;
export type Role = (typeof ROLES)[number];

export const EMPLOYMENT_TYPES = ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN"] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

const emergencyContactSchema = new Schema(
  {
    name: { type: String, trim: true },
    phone: { type: String, trim: true },
    relationship: { type: String, trim: true },
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    name: { type: String, required: true, trim: true },
    role: { type: String, enum: ROLES, required: true, default: "EMPLOYEE" },
    // PM is a sub-role flag on Employees (and elevatable on HR/Admin too — they
    // already have project-creation rights). Only Admin can flip this.
    isProjectManager: { type: Boolean, required: true, default: false },
    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, required: true, default: true },

    // Public profile
    jobTitle: { type: String, trim: true, maxlength: 100 },
    phone: { type: String, trim: true, maxlength: 25 },
    bio: { type: String, trim: true, maxlength: 500 },
    avatarUrl: { type: String },
    avatarKey: { type: String, select: false },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department", default: null, index: true },

    // Sensitive (self + HR + Admin)
    hireDate: { type: Date },
    dateOfBirth: { type: Date },
    address: { type: String, trim: true, maxlength: 200 },
    employmentType: { type: String, enum: EMPLOYMENT_TYPES },
    emergencyContact: { type: emergencyContactSchema, default: null },
    resumeUrl: { type: String },
    resumeKey: { type: String, select: false },

    // Auth-extensions: force-change-password + TOTP 2FA
    // mustChangePassword is true when the password was server-generated
    // (HR-created users or initial admin) so the FE can force a change on first login.
    mustChangePassword: { type: Boolean, default: false },
    // TOTP shared secret (base32). select:false so it never leaks via /auth/me, etc.
    totpSecret: { type: String, default: null, select: false },
    totpEnabled: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: Types.ObjectId };
export type UserModel = Model<UserDoc>;

export const User: UserModel = model<UserDoc>("User", userSchema);
