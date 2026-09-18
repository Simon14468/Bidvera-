export const dynamic = "force-dynamic";

import { getSharedClientRequest } from "@/modules/client-requests";
import { BrandLogo } from "@/components/brand/brand-logo";
import Link from "next/link";

export default async function SharedClientRequestPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  let view;
  try {
    view = await getSharedClientRequest(token);
  } catch {
    return (
      <div className="mx-auto flex min-h-full max-w-lg flex-col justify-center px-4 py-16">
        <BrandLogo href="/" height={32} />
        <h1 className="mt-8 text-xl font-semibold">Link unavailable</h1>
        <p className="mt-2 text-sm text-muted">
          This share link is invalid, expired, or has been revoked.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-full max-w-2xl px-4 py-10 sm:px-6">
      <BrandLogo href="/" height={32} />
      <p className="mt-8 text-xs font-medium uppercase tracking-wider text-muted">
        Client Request
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">{view.title}</h1>
      <p className="mt-2 text-sm text-muted">
        Company: <span className="text-foreground">{view.companyName}</span>
      </p>
      <p className="text-sm text-muted">Prepared for {view.clientName}</p>
      <p className="mt-1 text-sm text-muted">
        Deadline {view.deadline.slice(0, 10)} · Last updated{" "}
        {view.updatedAt.slice(0, 10)} · {view.progressPercent}% complete
      </p>

      {view.description ? (
        <p className="mt-4 text-sm whitespace-pre-wrap text-muted">
          {view.description}
        </p>
      ) : null}

      <section className="mt-8 space-y-3">
        <h2 className="text-base font-semibold">Requested items</h2>
        <ul className="divide-y divide-border rounded-xl border border-border">
          {view.items.map((item) => (
            <li key={item.id} className="px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {item.status === "COMPLETED" ? "✓" : "○"} {item.label}
                  </p>
                  {item.documentLabel ? (
                    <p className="text-sm text-muted">{item.documentLabel}</p>
                  ) : null}
                  {item.informationValue ? (
                    <p className="mt-1 text-sm whitespace-pre-wrap">
                      {item.informationValue}
                    </p>
                  ) : null}
                </div>
                {item.hasDownload ? (
                  <Link
                    href={`/api/share/client-request/${token}/files/${item.id}`}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    Download
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {view.companyProfile ? (
        <section className="mt-8 space-y-2 rounded-xl border border-border p-4">
          <h2 className="text-base font-semibold">Company Profile</h2>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted">Industry</dt>
              <dd>{view.companyProfile.industry || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">Country</dt>
              <dd>{view.companyProfile.country || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">Company size</dt>
              <dd>{view.companyProfile.companySize || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">Employees</dt>
              <dd>{view.companyProfile.employeeRange || "—"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted">Services</dt>
              <dd>
                {view.companyProfile.services.length
                  ? view.companyProfile.services.join(", ")
                  : "—"}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted">Certifications</dt>
              <dd>
                {view.companyProfile.certifications.length
                  ? view.companyProfile.certifications.join(", ")
                  : "—"}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted">Coverage</dt>
              <dd>
                {view.companyProfile.geographicCoverage.length
                  ? view.companyProfile.geographicCoverage.join(", ")
                  : "—"}
              </dd>
            </div>
          </dl>
        </section>
      ) : null}

      <p className="mt-10 text-xs text-muted">
        Shared securely via Bidvera. Only items selected by the owner are shown.
      </p>
    </div>
  );
}
