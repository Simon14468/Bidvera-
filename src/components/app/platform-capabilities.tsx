import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import {
  CalendarDays,
  ClipboardCheck,
  FileCheck2,
  FileSearch,
  Lock,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

export type PlatformCapabilityCard = {
  id: string;
  title: string;
  description: string;
  href: string;
  statusLabel: string;
  enabled: boolean;
  empty: boolean;
  ctaLabel: string;
};

const ICONS = {
  tender_analysis: FileSearch,
  document_compliance: FileCheck2,
  supplier_qualification: ClipboardCheck,
  tender_calendar: CalendarDays,
} as const;

export function PlatformCapabilities({
  title,
  hint,
  cards,
}: {
  title: string;
  hint: string;
  cards: PlatformCapabilityCard[];
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        <p className="mt-0.5 text-sm text-muted">{hint}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon =
            ICONS[card.id as keyof typeof ICONS] ?? FileSearch;
          const href = card.enabled ? card.href : "/upgrade";
          return (
            <Link key={card.id} href={href} className="group block min-w-0">
              <Card
                className={cn(
                  "h-full transition hover:border-primary/25 hover:shadow-[var(--shadow-soft)]",
                  !card.enabled && "opacity-90",
                )}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex size-9 items-center justify-center rounded-xl bg-primary-muted text-primary">
                      <Icon className="size-4" aria-hidden />
                    </div>
                    {!card.enabled ? (
                      <Lock className="size-3.5 shrink-0 text-muted" aria-hidden />
                    ) : null}
                  </div>
                  <CardTitle className="mt-2 text-sm">{card.title}</CardTitle>
                  <CardDescription className="line-clamp-2">
                    {card.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-xs text-muted">{card.statusLabel}</p>
                  <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary group-hover:underline">
                    {card.ctaLabel}
                    <ArrowRight className="size-3.5" aria-hidden />
                  </span>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
