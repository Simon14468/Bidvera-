export default function AppLoading() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <div
        className="size-8 animate-spin rounded-full border-2 border-border border-t-primary"
        aria-hidden
      />
      <p className="text-sm text-muted">Loading workspace…</p>
    </div>
  );
}
