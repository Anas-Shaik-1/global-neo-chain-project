import { z } from "zod";

/**
 * The "new call" dialog only has a search input — its value is unconstrained
 * but capped to a sensible length. We still validate via zod so the form is
 * uniformly RHF + Zod across the app.
 */
export const NewCallSearchSchema = z.object({
  query: z.string().max(120, "Keep it under 120 characters"),
});
export type NewCallSearchValues = z.infer<typeof NewCallSearchSchema>;
