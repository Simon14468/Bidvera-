/**
 * Known AI provider catalog for Super Admin UI.
 * Runtime resolution always comes from DB + env — these are defaults only.
 */
export const AI_PROVIDER_OPTIONS = [
  {
    key: "openai",
    name: "OpenAI",
    defaultBaseUrl: "https://api.openai.com/v1",
    apiKeyEnvVar: "OPENAI_API_KEY",
    /** Also accept AI_API_KEY as alias */
    apiKeyEnvAliases: ["AI_API_KEY"],
  },
  {
    key: "anthropic",
    name: "Anthropic Claude",
    defaultBaseUrl: "https://api.anthropic.com",
    apiKeyEnvVar: "ANTHROPIC_API_KEY",
    apiKeyEnvAliases: [] as string[],
  },
  {
    key: "google",
    name: "Google Gemini",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    apiKeyEnvVar: "GOOGLE_AI_API_KEY",
    apiKeyEnvAliases: ["GEMINI_API_KEY"],
  },
] as const;

export type AiProviderOptionKey = (typeof AI_PROVIDER_OPTIONS)[number]["key"];

export function getProviderOption(key: string) {
  return AI_PROVIDER_OPTIONS.find((p) => p.key === key) ?? null;
}
