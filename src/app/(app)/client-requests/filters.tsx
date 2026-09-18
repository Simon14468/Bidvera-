"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function ClientRequestsFilters({
  status,
  client,
  sort,
}: {
  status: string;
  client: string;
  sort: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function apply(next: { status?: string; client?: string; sort?: string }) {
    const params = new URLSearchParams();
    const s = next.status ?? status;
    const c = next.client ?? client;
    const so = next.sort ?? sort;
    if (s && s !== "ALL") params.set("status", s);
    if (c.trim()) params.set("client", c.trim());
    if (so && so !== "updated") params.set("sort", so);
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `/client-requests?${qs}` : "/client-requests");
    });
  }

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        apply({
          status: String(fd.get("status") || "ALL"),
          client: String(fd.get("client") || ""),
          sort: String(fd.get("sort") || "updated"),
        });
      }}
    >
      <label className="space-y-1 text-xs font-medium text-muted">
        Status
        <select
          name="status"
          defaultValue={status}
          className="block h-10 min-w-[10rem] rounded-xl border border-border bg-background px-3 text-sm text-foreground"
        >
          <option value="ALL">All</option>
          <option value="PENDING">Pending</option>
          <option value="IN_PROGRESS">In progress</option>
          <option value="COMPLETED">Completed</option>
          <option value="OVERDUE">Overdue</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </label>
      <label className="space-y-1 text-xs font-medium text-muted">
        Client
        <input
          name="client"
          defaultValue={client}
          placeholder="Client name"
          className="block h-10 min-w-[12rem] rounded-xl border border-border bg-background px-3 text-sm"
        />
      </label>
      <label className="space-y-1 text-xs font-medium text-muted">
        Sort
        <select
          name="sort"
          defaultValue={sort}
          className="block h-10 min-w-[10rem] rounded-xl border border-border bg-background px-3 text-sm text-foreground"
        >
          <option value="updated">Recently updated</option>
          <option value="deadline">Deadline</option>
          <option value="client">Client</option>
          <option value="status">Status</option>
        </select>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-10 items-center rounded-xl border border-border px-4 text-sm font-medium hover:bg-foreground/[0.04] disabled:opacity-60"
      >
        Apply
      </button>
    </form>
  );
}
