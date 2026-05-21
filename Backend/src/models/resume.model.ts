import { Schema, model, type InferSchemaType, type Model } from "mongoose";

/**
 * Resume builder document — one per user. Modelled after the public
 * resume.globalneochain.com builder: editable sections rendered to a
 * downloadable PDF. Every authenticated role can build and download
 * their own; nobody but the owner (and admins, optionally) can read.
 *
 * `_id: false` on every nested subdoc so the FE can replace whole
 * arrays on save without Mongoose stamping orphan ObjectIds we'd then
 * have to round-trip back to the form.
 */

const linkSchema = new Schema(
  {
    label: { type: String, trim: true, maxlength: 60, default: "" },
    url: { type: String, trim: true, maxlength: 200, default: "" },
  },
  { _id: false },
);

const experienceSchema = new Schema(
  {
    company: { type: String, trim: true, maxlength: 100, default: "" },
    role: { type: String, trim: true, maxlength: 100, default: "" },
    location: { type: String, trim: true, maxlength: 80, default: "" },
    /** Free-form date strings ("2023-01", "Jan 2023") so users can match
     *  the format their target role expects. No validation past length. */
    startDate: { type: String, trim: true, maxlength: 20, default: "" },
    endDate: { type: String, trim: true, maxlength: 20, default: "" },
    current: { type: Boolean, default: false },
    bullets: {
      type: [{ type: String, trim: true, maxlength: 300 }],
      default: [],
      validate: {
        validator: (a: string[]) => a.length <= 12,
        message: "experience bullets capped at 12",
      },
    },
  },
  { _id: false },
);

const educationSchema = new Schema(
  {
    institution: { type: String, trim: true, maxlength: 100, default: "" },
    degree: { type: String, trim: true, maxlength: 100, default: "" },
    field: { type: String, trim: true, maxlength: 100, default: "" },
    startDate: { type: String, trim: true, maxlength: 20, default: "" },
    endDate: { type: String, trim: true, maxlength: 20, default: "" },
    current: { type: Boolean, default: false },
    notes: { type: String, trim: true, maxlength: 200, default: "" },
  },
  { _id: false },
);

const skillGroupSchema = new Schema(
  {
    /** "Languages", "Tools", "Cloud", … */
    group: { type: String, trim: true, maxlength: 60, default: "" },
    items: {
      type: [{ type: String, trim: true, maxlength: 60 }],
      default: [],
      validate: {
        validator: (a: string[]) => a.length <= 30,
        message: "skill items per group capped at 30",
      },
    },
  },
  { _id: false },
);

const projectSchema = new Schema(
  {
    name: { type: String, trim: true, maxlength: 100, default: "" },
    role: { type: String, trim: true, maxlength: 100, default: "" },
    year: { type: String, trim: true, maxlength: 12, default: "" },
    body: { type: String, trim: true, maxlength: 600, default: "" },
    links: {
      type: [linkSchema],
      default: [],
      validate: { validator: (a: unknown[]) => a.length <= 3 },
    },
  },
  { _id: false },
);

const certificationSchema = new Schema(
  {
    name: { type: String, trim: true, maxlength: 120, default: "" },
    issuer: { type: String, trim: true, maxlength: 100, default: "" },
    year: { type: String, trim: true, maxlength: 12, default: "" },
  },
  { _id: false },
);

const languageSchema = new Schema(
  {
    name: { type: String, trim: true, maxlength: 40, default: "" },
    /** Free-form: "Native", "Fluent", "Conversational", "Basic". */
    proficiency: { type: String, trim: true, maxlength: 30, default: "" },
  },
  { _id: false },
);

export const RESUME_TEMPLATES = ["minimal", "modern", "compact"] as const;
export type ResumeTemplate = (typeof RESUME_TEMPLATES)[number];

const resumeSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    fullName: { type: String, trim: true, maxlength: 100, default: "" },
    headline: { type: String, trim: true, maxlength: 120, default: "" },
    email: { type: String, trim: true, maxlength: 120, default: "" },
    phone: { type: String, trim: true, maxlength: 30, default: "" },
    location: { type: String, trim: true, maxlength: 80, default: "" },
    links: {
      type: [linkSchema],
      default: [],
      validate: { validator: (a: unknown[]) => a.length <= 6 },
    },
    summary: { type: String, trim: true, maxlength: 800, default: "" },
    experience: { type: [experienceSchema], default: [] },
    education: { type: [educationSchema], default: [] },
    skills: { type: [skillGroupSchema], default: [] },
    projects: { type: [projectSchema], default: [] },
    certifications: { type: [certificationSchema], default: [] },
    languages: { type: [languageSchema], default: [] },
    template: {
      type: String,
      enum: RESUME_TEMPLATES,
      default: "minimal",
    },
  },
  { timestamps: true },
);

export type ResumeDoc = InferSchemaType<typeof resumeSchema>;
export type ResumeModel = Model<ResumeDoc>;
export const Resume: ResumeModel = model<ResumeDoc>("Resume", resumeSchema);
