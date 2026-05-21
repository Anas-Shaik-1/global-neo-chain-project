import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { registry } from "../../openapi/registry.js";
import { RESUME_TEMPLATES } from "../../models/resume.model.js";

extendZodWithOpenApi(z);

const Link = z.object({
  label: z.string().trim().max(60).default(""),
  url: z.string().trim().max(200).default(""),
});

const Experience = z.object({
  company: z.string().trim().max(100).default(""),
  role: z.string().trim().max(100).default(""),
  location: z.string().trim().max(80).default(""),
  startDate: z.string().trim().max(20).default(""),
  endDate: z.string().trim().max(20).default(""),
  current: z.boolean().default(false),
  bullets: z.array(z.string().trim().max(300)).max(12).default([]),
});

const Education = z.object({
  institution: z.string().trim().max(100).default(""),
  degree: z.string().trim().max(100).default(""),
  field: z.string().trim().max(100).default(""),
  startDate: z.string().trim().max(20).default(""),
  endDate: z.string().trim().max(20).default(""),
  current: z.boolean().default(false),
  notes: z.string().trim().max(200).default(""),
});

const SkillGroup = z.object({
  group: z.string().trim().max(60).default(""),
  items: z.array(z.string().trim().max(60)).max(30).default([]),
});

const Project = z.object({
  name: z.string().trim().max(100).default(""),
  role: z.string().trim().max(100).default(""),
  year: z.string().trim().max(12).default(""),
  body: z.string().trim().max(600).default(""),
  links: z.array(Link).max(3).default([]),
});

const Certification = z.object({
  name: z.string().trim().max(120).default(""),
  issuer: z.string().trim().max(100).default(""),
  year: z.string().trim().max(12).default(""),
});

const Language = z.object({
  name: z.string().trim().max(40).default(""),
  proficiency: z.string().trim().max(30).default(""),
});

export const ResumeBody = z.object({
  fullName: z.string().trim().max(100).default(""),
  headline: z.string().trim().max(120).default(""),
  email: z.string().trim().max(120).default(""),
  phone: z.string().trim().max(30).default(""),
  location: z.string().trim().max(80).default(""),
  links: z.array(Link).max(6).default([]),
  summary: z.string().trim().max(800).default(""),
  experience: z.array(Experience).max(20).default([]),
  education: z.array(Education).max(10).default([]),
  skills: z.array(SkillGroup).max(10).default([]),
  projects: z.array(Project).max(20).default([]),
  certifications: z.array(Certification).max(20).default([]),
  languages: z.array(Language).max(10).default([]),
  template: z.enum(RESUME_TEMPLATES).default("minimal"),
});

export type ResumeBodyType = z.infer<typeof ResumeBody>;

export const ResumeResponse = ResumeBody.extend({
  id: z.string(),
  userId: z.string(),
  updatedAt: z.string().datetime().optional(),
}).openapi("Resume");

registry.registerPath({
  method: "get",
  path: "/resume/me",
  tags: ["Resume"],
  responses: {
    200: { description: "Current user's resume", content: { "application/json": { schema: ResumeResponse } } },
  },
});

registry.registerPath({
  method: "put",
  path: "/resume/me",
  tags: ["Resume"],
  request: { body: { content: { "application/json": { schema: ResumeBody } } } },
  responses: {
    200: { description: "Saved resume", content: { "application/json": { schema: ResumeResponse } } },
  },
});

registry.registerPath({
  method: "get",
  path: "/resume/me/pdf",
  tags: ["Resume"],
  responses: {
    200: {
      description: "Rendered PDF",
      content: { "application/pdf": { schema: { type: "string", format: "binary" } } },
    },
  },
});

/** Import an existing resume from raw pasted text (PDF copy, LinkedIn
 *  export, plain markdown, etc.). The server parses heuristically and
 *  returns the structured result without saving — the FE shows the
 *  extracted fields and lets the user apply them to the editor. */
export const ImportResumeBody = z
  .object({
    text: z.string().min(20, "Paste a few lines of resume text first").max(20_000),
  })
  .openapi("ImportResumeBody");

registry.registerPath({
  method: "post",
  path: "/resume/me/import",
  tags: ["Resume"],
  request: { body: { content: { "application/json": { schema: ImportResumeBody } } } },
  responses: {
    200: {
      description: "Parsed (but not saved) resume in editor shape",
      content: { "application/json": { schema: ResumeBody } },
    },
  },
});
