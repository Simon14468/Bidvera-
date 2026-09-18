function statusTone(status: string): string {
  switch (status) {
    case "VALID":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    case "EXPIRING_SOON":
      return "bg-amber-500/15 text-amber-800 dark:text-amber-200";
    case "EXPIRED":
      return "bg-red-500/15 text-red-700 dark:text-red-300";
    case "NO_EXPIRY":
      return "bg-sky-500/15 text-sky-800 dark:text-sky-200";
    default:
      return "bg-foreground/10 text-muted";
  }
}

export function ComplianceStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-wide ${statusTone(status)}`}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}
