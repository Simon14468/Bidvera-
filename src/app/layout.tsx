import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_Arabic } from "next/font/google";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { siteConfig } from "@/config/site";
import { getDirection } from "@/i18n/config";
import { getLocale } from "@/i18n/get-locale";
import { getDictionary } from "@/i18n/dictionaries";
import {
  JsonLd,
  organizationJsonLd,
  softwareApplicationJsonLd,
  websiteJsonLd,
} from "@/seo/json-ld";
import { getSearchVerificationMeta } from "@/seo/discovery";
import { absoluteUrl, localeHref, localeToOgLocale, siteEntity } from "@/seo/site-entity";
import { hreflangLocales } from "@/seo/site-entity";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoArabic = Noto_Sans_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
});

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const ogImage = absoluteUrl(siteEntity.ogImagePath);
  const languages: Record<string, string> = {};
  for (const loc of hreflangLocales) {
    languages[loc] = localeHref("/", loc);
  }
  languages["x-default"] = absoluteUrl("/");

  return {
    metadataBase: new URL(siteConfig.url),
    title: {
      default: `${siteConfig.name} — ${t.brand.tagline}`,
      template: `%s · ${siteConfig.name}`,
    },
    description: t.brand.description,
    alternates: {
      canonical: absoluteUrl("/"),
      languages,
    },
    openGraph: {
      type: "website",
      locale: localeToOgLocale[locale],
      url: siteEntity.url,
      siteName: siteConfig.name,
      title: `${siteConfig.name} — ${t.brand.tagline}`,
      description: t.brand.description,
      images: [{ url: ogImage, alt: `${siteConfig.name} logo` }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${siteConfig.name} — ${t.brand.tagline}`,
      description: t.brand.description,
      images: [ogImage],
    },
    robots: {
      index: true,
      follow: true,
    },
    verification: (() => {
      const meta = getSearchVerificationMeta();
      const out: { google?: string; other?: Record<string, string> } = {};
      if (meta["google-site-verification"]) {
        out.google = meta["google-site-verification"];
      }
      if (meta["msvalidate.01"]) {
        out.other = { "msvalidate.01": meta["msvalidate.01"] };
      }
      return Object.keys(out).length ? out : undefined;
    })(),
    icons: {
      icon: [
        { url: "/brand-mark.png", type: "image/png", sizes: "any" },
        { url: "/favicon.png", type: "image/png", sizes: "32x32" },
      ],
      shortcut: "/brand-mark.png",
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: siteConfig.name,
    },
    other: {
      "mobile-web-app-capable": "yes",
    },
  };
}

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#3F9F32" },
    { media: "(prefers-color-scheme: dark)", color: "#232B23" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const dir = getDirection(locale);

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${geistSans.variable} ${geistMono.variable} ${notoArabic.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body
        className={`min-w-0 min-h-full bg-background text-foreground ${
          locale === "ar" ? "font-[family-name:var(--font-arabic),var(--font-geist-sans)]" : ""
        }`}
      >
        <JsonLd data={organizationJsonLd()} />
        <JsonLd data={websiteJsonLd()} />
        <JsonLd data={softwareApplicationJsonLd()} />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
