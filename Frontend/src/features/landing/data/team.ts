/**
 * Team roster — single source of truth for both /team and the landing-page
 * Team preview. When a member's photo lands at
 * /public/team/<slug>.jpg, set `photo` to that path and the UI swaps the
 * gradient-initials placeholder for the real <img>.
 */
export interface TeamMember {
  name: string;
  role: string;
  /** Optional path under /public, e.g. "/team/ruhina-begum.jpg". */
  photo?: string;
}

export const LEADERSHIP: TeamMember[] = [
  { name: "Ruhina Begum Shaik", role: "Project Manager" },
  { name: "Sagar Chedde", role: "Project Lead & Consultant" },
  { name: "Muhib Shaik", role: "Admin Manager & Scrum Master" },
  { name: "Rehman Shaik", role: "Team Lead & Senior Developer" },
  { name: "Rasool Shaik", role: "DevOps Manager" },
];

export const ENGINEERS: TeamMember[] = [
  { name: "Afrid Sk", role: "Full Stack Developer" },
  { name: "Matin Syed", role: "Senior Developer" },
  { name: "Tejaswini Kommi", role: "Senior Automation Tester" },
  { name: "Chand Basha", role: "Senior Developer" },
  { name: "Asif Mohammad Shaik", role: "Full Stack Developer" },
  { name: "Fazil Ahmed Syed", role: "Senior Developer" },
  { name: "Afroz Ahmed Shaik", role: "Full Stack Developer" },
  { name: "Meera Mohiddin Shaik", role: "Senior Developer" },
  { name: "Rajashekar Vanjeti", role: "Senior Developer" },
  { name: "Adnan Shaik", role: "DevOps Engineer" },
];

export const ASSOCIATES: TeamMember[] = [
  { name: "Sayad Soheal", role: "Junior Developer" },
  { name: "Abdul Hafeez Syed", role: "Junior Developer" },
  { name: "Sanavulla Shaik", role: "Automation Tester" },
  { name: "Irfan Mohammed", role: "DevOps Engineer" },
  { name: "Shaik Zakeer", role: "Junior Developer" },
  { name: "Jayanth", role: "DevOps Engineer" },
  { name: "Hussain Khan", role: "Junior Developer" },
  { name: "Ameen Sahil Shaik", role: "Tester" },
];

export const ALL_MEMBERS: TeamMember[] = [
  ...LEADERSHIP,
  ...ENGINEERS,
  ...ASSOCIATES,
];

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/**
 * Convert a display name into a kebab-case file slug. Used to look up the
 * matching photo at /team/<slug>.jpg without forcing every team-data row
 * to repeat the path.
 */
export function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

/** Default photo path for a member — `/public/team/<slug>.jpg`. */
export function defaultPhotoFor(name: string): string {
  return `/team/${slugifyName(name)}.jpg`;
}

/** Deterministic gradient per name so the avatar wall stays colourful. */
export function gradientFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `linear-gradient(135deg, hsl(${hue} 70% 55%) 0%, hsl(${(hue + 40) % 360} 70% 45%) 100%)`;
}
