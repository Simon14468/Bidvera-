export function MetricGrid({
  items,
}: {
  items: Array<{ label: string; value: string | number }>;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
        >
          <p className="text-2xl font-semibold text-white">{item.value}</p>
          <p className="mt-1 text-xs text-slate-400">{item.label}</p>
        </div>
      ))}
    </div>
  );
}
