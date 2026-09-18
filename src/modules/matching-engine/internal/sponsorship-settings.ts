/**
 * Matching sponsorship global settings (Feature 8F).
 * OFF by default — no pay-to-win while disabled.
 */

import { getSetting, setSetting } from "@/services/settings";
import { z } from "zod";

export const MATCHING_SPONSORSHIP_SETTINGS_KEY = "matching.sponsorship.settings";

export const matchingSponsorshipSettingsSchema = z.object({
  enabledGlobal: z.boolean().default(false),
});

export type MatchingSponsorshipSettings = z.infer<
  typeof matchingSponsorshipSettingsSchema
>;

export const DEFAULT_MATCHING_SPONSORSHIP_SETTINGS: MatchingSponsorshipSettings =
  {
    enabledGlobal: false,
  };

export async function getMatchingSponsorshipSettings(): Promise<MatchingSponsorshipSettings> {
  const raw = await getSetting<unknown>(
    MATCHING_SPONSORSHIP_SETTINGS_KEY,
    DEFAULT_MATCHING_SPONSORSHIP_SETTINGS,
  );
  const parsed = matchingSponsorshipSettingsSchema.safeParse(raw);
  return parsed.success
    ? parsed.data
    : { ...DEFAULT_MATCHING_SPONSORSHIP_SETTINGS };
}

export async function isMatchingSponsorshipGloballyEnabled(): Promise<boolean> {
  const s = await getMatchingSponsorshipSettings();
  return s.enabledGlobal === true;
}

export async function setMatchingSponsorshipGloballyEnabled(
  enabled: boolean,
): Promise<MatchingSponsorshipSettings> {
  const next: MatchingSponsorshipSettings = { enabledGlobal: enabled };
  await setSetting(MATCHING_SPONSORSHIP_SETTINGS_KEY, next);
  return next;
}
