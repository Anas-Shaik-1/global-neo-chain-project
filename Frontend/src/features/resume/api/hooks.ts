import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { getApi } from "@/api/axios";

const api = () => getApi();

function errorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    return (err.response?.data as { message?: string } | undefined)?.message ?? fallback;
  }
  return fallback;
}

export interface ResumeLink {
  label: string;
  url: string;
}
export interface ResumeExperience {
  company: string;
  role: string;
  location: string;
  startDate: string;
  endDate: string;
  current: boolean;
  bullets: string[];
}
export interface ResumeEducation {
  institution: string;
  degree: string;
  field: string;
  startDate: string;
  endDate: string;
  current: boolean;
  notes: string;
}
export interface ResumeSkillGroup {
  group: string;
  items: string[];
}
export interface ResumeProject {
  name: string;
  role: string;
  year: string;
  body: string;
  links: ResumeLink[];
}
export interface ResumeCertification {
  name: string;
  issuer: string;
  year: string;
}
export interface ResumeLanguage {
  name: string;
  proficiency: string;
}

export const RESUME_TEMPLATES = ["minimal", "modern", "compact"] as const;
export type ResumeTemplate = (typeof RESUME_TEMPLATES)[number];

export interface Resume {
  id: string;
  userId: string;
  fullName: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  links: ResumeLink[];
  summary: string;
  experience: ResumeExperience[];
  education: ResumeEducation[];
  skills: ResumeSkillGroup[];
  projects: ResumeProject[];
  certifications: ResumeCertification[];
  languages: ResumeLanguage[];
  template: ResumeTemplate;
  updatedAt?: string;
}

export type ResumeInput = Omit<Resume, "id" | "userId" | "updatedAt">;

const KEY = ["resume", "me"] as const;

export function useMyResume() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const res = await api().get("/resume/me");
      return res.data as Resume;
    },
  });
}

export function useSaveResume() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ResumeInput) => {
      const res = await api().put("/resume/me", input);
      return res.data as Resume;
    },
    onSuccess: (saved) => {
      qc.setQueryData(KEY, saved);
      toast.success("Resume saved");
    },
    onError: (err) => toast.error(errorMessage(err, "Could not save resume")),
  });
}

/**
 * Upload an existing resume PDF — server extracts text via pdfjs and
 * runs the same heuristic parser. Bytes live in server memory only,
 * never persisted.
 */
export function useImportResumePdf() {
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const res = await api().post("/resume/me/import-pdf", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data as ResumeInput;
    },
    onError: (err) => toast.error(errorMessage(err, "Could not read that PDF")),
  });
}

/**
 * Triggers a browser download of the user's resume PDF. Uses a one-shot
 * blob fetch + anchor click; the backend stamps Content-Disposition.
 */
export async function downloadResumePdf(filename: string) {
  const res = await api().get("/resume/me/pdf", { responseType: "blob" });
  const blob = res.data as Blob;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Empty templates for "Add" buttons in the form. Centralised so the
 * defaults stay in sync with the FE & BE Zod schemas.
 */
export const EMPTY_EXPERIENCE: ResumeExperience = {
  company: "",
  role: "",
  location: "",
  startDate: "",
  endDate: "",
  current: false,
  bullets: [""],
};
export const EMPTY_EDUCATION: ResumeEducation = {
  institution: "",
  degree: "",
  field: "",
  startDate: "",
  endDate: "",
  current: false,
  notes: "",
};
export const EMPTY_SKILL_GROUP: ResumeSkillGroup = { group: "", items: [] };
export const EMPTY_PROJECT: ResumeProject = {
  name: "",
  role: "",
  year: "",
  body: "",
  links: [],
};
export const EMPTY_CERT: ResumeCertification = { name: "", issuer: "", year: "" };
export const EMPTY_LANG: ResumeLanguage = { name: "", proficiency: "" };
export const EMPTY_LINK: ResumeLink = { label: "", url: "" };
