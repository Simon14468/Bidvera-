"use client";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { Dictionary } from "@/i18n/dictionaries";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

type TendersCopy = Dictionary["app"]["tenders"];

export function TenderFiltersBar({ copy }: { copy: TendersCopy }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const urlQuery = searchParams.get("query") ?? "";
  const [query, setQuery] = useState(urlQuery);
  const [querySource, setQuerySource] = useState(urlQuery);
  if (urlQuery !== querySource) {
    setQuerySource(urlQuery);
    setQuery(urlQuery);
  }
  const debounceRef = useRef<number | null>(null);

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === "ALL") params.delete(key);
    else params.set(key, value);
    startTransition(() => {
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div
      className={`grid gap-3 rounded-xl border border-border bg-background p-4 md:grid-cols-2 xl:grid-cols-5 ${
        pending ? "opacity-70" : ""
      }`}
    >
      <Input
        label={copy.search}
        placeholder={copy.searchPlaceholder}
        value={query}
        onChange={(e) => {
          const value = e.target.value;
          setQuery(value);
          if (debounceRef.current) window.clearTimeout(debounceRef.current);
          debounceRef.current = window.setTimeout(() => update("query", value), 300);
        }}
      />
      <Select
        label={copy.decision}
        value={searchParams.get("decision") ?? "ALL"}
        onChange={(e) => update("decision", e.target.value)}
        options={[
          { value: "ALL", label: copy.allDecisions },
          { value: "BID", label: copy.bid },
          { value: "REVIEW", label: copy.review },
          { value: "NO_BID", label: copy.noBid },
        ]}
      />
      <Select
        label={copy.risk}
        value={searchParams.get("risk") ?? "ALL"}
        onChange={(e) => update("risk", e.target.value)}
        options={[
          { value: "ALL", label: copy.allRiskLevels },
          { value: "LOW", label: copy.low },
          { value: "MEDIUM", label: copy.medium },
          { value: "HIGH", label: copy.high },
          { value: "CRITICAL", label: copy.critical },
        ]}
      />
      <Select
        label={copy.deadline}
        value={searchParams.get("deadline") ?? "ALL"}
        onChange={(e) => update("deadline", e.target.value)}
        options={[
          { value: "ALL", label: copy.anyDeadline },
          { value: "7D", label: copy.next7d },
          { value: "14D", label: copy.next14d },
          { value: "30D", label: copy.next30d },
          { value: "OVERDUE", label: copy.overdue },
        ]}
      />
      <Select
        label={copy.sort}
        value={searchParams.get("sort") ?? "analyzed_desc"}
        onChange={(e) => update("sort", e.target.value)}
        options={[
          { value: "analyzed_desc", label: copy.sortRecent },
          { value: "deadline_asc", label: copy.sortDeadlineSoon },
          { value: "deadline_desc", label: copy.sortDeadlineLate },
          { value: "fit_desc", label: copy.sortFit },
          { value: "title_asc", label: copy.sortTitle },
        ]}
      />
    </div>
  );
}
