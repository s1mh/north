import { z } from "zod";

export const themePreferenceSchema = z.object({
  theme: z.enum(["system", "light", "dark"]),
});

export type ThemePreference = z.infer<typeof themePreferenceSchema>["theme"];
