import { confirmEmailChange } from "@/app/actions";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/get-locale";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function ConfirmEmailChangePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const t = getDictionary(await getLocale()).app.settings;

  if (!token) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md">
          <CardHeader className="items-center text-center">
            <BrandLogo href="/" height={36} />
            <CardTitle className="mt-4">{t.emailChangeInvalidTitle}</CardTitle>
            <CardDescription>{t.emailChangeInvalidBody}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Link href="/settings" className="text-primary hover:underline">
              {t.emailChangeBackSettings}
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const result = await confirmEmailChange(token);
  if (result.ok) {
    redirect(result.data.redirectTo);
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <BrandLogo href="/" height={36} />
          <CardTitle className="mt-4">{t.emailChangeInvalidTitle}</CardTitle>
          <CardDescription>{result.error.message}</CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Link href="/settings" className="text-primary hover:underline">
            {t.emailChangeBackSettings}
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
