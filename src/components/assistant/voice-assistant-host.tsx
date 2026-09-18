import { BidveraVoiceAssistant } from "@/components/assistant/voice-assistant";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/get-locale";
import { getPublicAssistantFlags } from "@/services/ai/assistant-settings";

/** Server wrapper — mounts FAB only when Super Admin left the assistant ON. */
export async function BidveraVoiceAssistantHost() {
  const flags = await getPublicAssistantFlags();
  if (!flags.enabled) return null;

  const locale = await getLocale();
  const copy = getDictionary(locale).assistant;
  return (
    <BidveraVoiceAssistant
      copy={copy}
      locale={locale}
      voiceEnabled={flags.voiceEnabled}
    />
  );
}
