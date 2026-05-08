import { Schema, model, type InferSchemaType, type Model, Types } from "mongoose";

// Roles. TESTER is a specialised flavour of EMPLOYEE that owns the Bugs
// module — they're the only role that can file or edit bug reports; the
// rest of the platform treats them with EMPLOYEE-level access elsewhere.
export const ROLES = ["ADMIN", "HR", "EMPLOYEE", "TESTER"] as const;
export type Role = (typeof ROLES)[number];

export const EMPLOYMENT_TYPES = ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN"] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

/**
 * Two-stage approval pipeline for new accounts:
 *   PENDING_HR     → public registration just submitted, HR hasn't reviewed yet
 *   PENDING_ADMIN  → HR signed off, awaiting Admin's final approval
 *   ACTIVE         → Admin signed off, the account can now log in
 *   REJECTED       → either HR or Admin declined the application
 *
 * Login is gated on `approvalStatus === "ACTIVE"` — see auth.service.
 */
export const APPROVAL_STATUSES = [
  "PENDING_HR",
  "PENDING_ADMIN",
  "ACTIVE",
  "REJECTED",
] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

const emergencyContactSchema = new Schema(
  {
    name: { type: String, trim: true },
    phone: { type: String, trim: true },
    relationship: { type: String, trim: true },
  },
  { _id: false },
);

const avatarVariantsSchema = new Schema(
  {
    small: { type: String, default: null },
    medium: { type: String, default: null },
    large: { type: String, default: null },
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    /**
     * Human-friendly identifier stamped on a user when admin approves them
     * (or, for seed/legacy users, retroactively on first lookup). Format is
     * `EMP-<YYYY>-<NNNN>` where NNNN is a per-year sequence padded to four
     * digits — same as the printable HR-style ID used on payslips and ID
     * cards. Sparse so docs created before this field existed don't fail
     * the unique constraint until they get one assigned.
     */
    employeeId: {
      type: String,
      // No `default: null` — Mongoose would stamp every doc with literal
      // null and the sparse index treats null as a value, blowing up the
      // second insert with E11000. Leaving the field absent until allocated.
      unique: true,
      sparse: true,
      trim: true,
    },
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
    /**
     * Cloudinary-driven responsive avatar URLs. Populated when an avatar is
     * saved via STORAGE_DRIVER=cloudinary; the local driver leaves these
     * null and FE callers fall back to `avatarUrl`. Each variant is a
     * fully-qualified CDN URL with a face-aware crop transformation baked
     * in (small=64, medium=128, large=512).
     */
    avatarVariants: { type: avatarVariantsSchema, default: () => ({}) },
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
    // Last accepted TOTP step counter — replay protection. select:false so
    // it never leaks via /auth/me or other find queries.
    totpLastUsedStep: { type: Number, default: 0, select: false },

    // Phone-number verification via 6-digit SMS OTP. The hash defends against
    // DB-leak token replay; the attempts counter throttles brute-force (we
    // refuse a 6th wrong submission and require a fresh code request).
    isPhoneVerified: { type: Boolean, required: true, default: false },
    phoneVerificationCodeHash: { type: String, default: null, select: false },
    phoneVerificationExpiresAt: { type: Date, default: null, select: false },
    phoneVerificationAttempts: { type: Number, default: 0, select: false },

    // Self-registration + 2-stage approval pipeline. New accounts default to
    // PENDING_HR; existing seeded users (admin/hr/pm/employee) are explicitly
    // stamped ACTIVE on creation, and the seed has a backfill step for any
    // legacy docs that pre-date this column.
    approvalStatus: {
      type: String,
      enum: APPROVAL_STATUSES,
      required: true,
      default: "PENDING_HR",
      index: true,
    },
    approvalNotes: { type: String, default: null, maxlength: 500 },
    hrApprovedById: { type: Schema.Types.ObjectId, ref: "User", default: null },
    hrApprovedAt: { type: Date, default: null },
    adminApprovedById: { type: Schema.Types.ObjectId, ref: "User", default: null },
    adminApprovedAt: { type: Date, default: null },
    rejectedById: { type: Schema.Types.ObjectId, ref: "User", default: null },
    rejectedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: Types.ObjectId };
export type UserModel = Model<UserDoc>;

export const User: UserModel = model<UserDoc>("User", userSchema);
