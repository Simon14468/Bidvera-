import Link from "next/link";

export function FreeWorkspaceTrialBanner({
  title,
  body,
  cta,
  href,
  tone,
}: {
  title: string;
  body: string;
  cta: string;
  href: string;
  tone: "trial" | "expired";
}) {
  const expired = tone === "expired";
  return (
    <div
      role="status"
      className={
        expired
          ? "mb-6 flex flex-col gap-3 rounded-[12px] border border-[#EF4444]/25 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          : "mb-6 flex flex-col gap-3 rounded-[12px] border border-[#F59E0B]/30 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
      }
    >
      <div className="min-w-0">
        <p className="break-words text-sm font-semibold text-[#1A1D1F]">{title}</p>
        <p className="mt-0.5 break-words text-sm text-[#6B7280]">{body}</p>
      </div>
      <Link
        href={href}
        className="inline-flex h-11 w-full shrink-0 items-center justify-center rounded-[12px] bg-[#4CAF6D] px-4 text-sm font-medium text-white transition hover:opacity-90 sm:h-10 sm:w-auto"
      >
        {cta}
      </Link>
    </div>
  );
}
