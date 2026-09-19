import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/get-locale";

export default async function AppLoading() {
  const locale = await getLocale();
  const label = getDictionary(locale).app.common.loadingWorkspace;

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <div
        className="size-8 animate-spin rounded-full border-2 border-border border-t-primary"
        aria-hidden
      />
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}
