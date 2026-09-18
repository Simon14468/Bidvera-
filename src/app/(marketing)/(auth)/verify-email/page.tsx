import { verifyEmail } from "@/app/actions";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/get-locale";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const t = getDictionary(await getLocale()).app.onboarding;

  if (!token) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md">
          <CardHeader className="items-center text-center">
            <BrandLogo href="/" height={36} />
            <CardTitle className="mt-4">{t.verifyInvalidTitle}</CardTitle>
            <CardDescription>{t.verifyInvalidBody}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Link href="/onboarding/verify" className="text-primary hover:underline">
              {t.resend}
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const result = await verifyEmail(token);
  if (result.ok) {
    redirect(result.data.redirectTo);
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <BrandLogo href="/" height={36} />
          <CardTitle className="mt-4">{t.verifyInvalidTitle}</CardTitle>
          <CardDescription>{result.error.message}</CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Link href="/onboarding/verify" className="text-primary hover:underline">
            {t.resend}
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
