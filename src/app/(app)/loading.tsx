import { Skeleton } from "@/components/ui/loading";

/** Instant shell placeholder — no i18n/DB awaits so navigation feels snappy. */
export default function AppLoading() {
  return (
    <div
      className="animate-fade-in space-y-4"
      role="status"
      aria-busy="true"
      aria-label="Loading"
    >
      <div className="space-y-2">
        <Skeleton className="h-7 w-48 max-w-full" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <Skeleton className="h-36 w-full" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full sm:col-span-2 lg:col-span-1" />
      </div>
    </div>
  );
}
