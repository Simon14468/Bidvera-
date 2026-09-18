import { LandingVideoEditor } from "@/components/super-admin/landing-video-editor";
import { listLandingVideosForAdmin } from "@/application/admin/landing-service";
import { requireSuperAdmin } from "@/auth/super-admin-session";
import { locales, type Locale } from "@/i18n/config";

export const dynamic = "force-dynamic";

export default async function SaLandingVideoPage() {
  await requireSuperAdmin();
  const byLocale = await listLandingVideosForAdmin();

  const initialByLocale = Object.fromEntries(
    locales.map((locale) => {
      const video = byLocale[locale];
      return [
        locale,
        {
          enabled: video.enabled,
          title: video.title,
          description: video.description,
          youtubeUrl: video.youtubeUrl,
          videoUrl: video.videoUrl,
          posterUrl: video.posterUrl,
        },
      ];
    }),
  ) as Record<
    Locale,
    {
      enabled: boolean;
      title: string;
      description: string | null;
      youtubeUrl: string | null;
      videoUrl: string | null;
      posterUrl: string | null;
    }
  >;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Landing product video</h1>
        <p className="mt-1 text-sm text-slate-400">
          Set a different YouTube or uploaded video for each language. The marketing page
          shows the video matching the visitor&apos;s language switcher (falls back to
          English).
        </p>
      </div>
      <LandingVideoEditor initialByLocale={initialByLocale} />
    </div>
  );
}
