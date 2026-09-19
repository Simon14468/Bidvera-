export const dynamic = "force-dynamic";

import { requireClientRequestsModule } from "@/modules/client-requests";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/get-locale";
import Link from "next/link";
import { CreateClientRequestForm } from "../create-form";

export default async function NewClientRequestPage() {
  const locale = await getLocale();
  const t = getDictionary(locale).app.clientRequests;
  await requireClientRequestsModule();
  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade-in">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted">
          {t.eyebrow}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{t.createRequest}</h1>
        <p className="mt-1 text-sm text-muted">{t.newSubtitle}</p>
        <Link
          href="/client-requests"
          className="mt-2 inline-block text-sm text-primary hover:underline"
        >
          ← {t.backToList}
        </Link>
      </div>
      <CreateClientRequestForm />
    </div>
  );
}
