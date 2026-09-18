"use client";

import { completeCompanyOnboarding, skipCompanyOnboarding } from "@/app/actions";
import {
  COMPANY_SIZE_OPTIONS,
  COUNTRY_OPTIONS,
  EXPERIENCE_LEVEL_OPTIONS,
  INDUSTRY_OPTIONS,
} from "@/config/company-options";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TurnstileField } from "@/components/security/turnstile-field";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, KeyboardEvent, useState, useTransition } from "react";

const selectClass =
  "h-10 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function CompanyOnboardingForm({
  copy,
  turnstileSiteKey,
}: {
  turnstileSiteKey?: string | null;
  copy: {
    title: string;
    body: string;
    companyName: string;
    country: string;
    industry: string;
    companySize: string;
    services: string;
    servicesHint: string;
    experience: string;
    experienceOptional: string;
    privacyNote: string;
    companySubmit: string;
    companySkip: string;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [industry, setIndustry] = useState("");
  const [industryOther, setIndustryOther] = useState("");
  const [services, setServices] = useState<string[]>([]);
  const [serviceDraft, setServiceDraft] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileReset, setTurnstileReset] = useState(0);

  function addService(raw: string) {
    const value = raw.trim().replace(/,+$/, "");
    if (!value) return;
    setServices((prev) => {
      if (prev.some((s) => s.toLowerCase() === value.toLowerCase())) return prev;
      if (prev.length >= 30) return prev;
      return [...prev, value.slice(0, 80)];
    });
    setServiceDraft("");
  }

  function onServiceKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addService(serviceDraft);
    } else if (e.key === "Backspace" && !serviceDraft && services.length) {
      setServices((prev) => prev.slice(0, -1));
    }
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const resolvedIndustry =
      industry === "Other" ? industryOther.trim() : industry.trim();
    if (!resolvedIndustry) {
      setError("Select an industry or enter one under Other.");
      return;
    }
    if (services.length === 0) {
      setError("Add at least one service or capability.");
      return;
    }
    const experienceRaw = String(fd.get("experienceLevel") ?? "");
    const payload = {
      companyName: String(fd.get("companyName") ?? "").trim(),
      country: String(fd.get("country") ?? ""),
      industry: resolvedIndustry,
      companySize: String(fd.get("companySize") ?? "") as
        | "Solo"
        | "Small"
        | "Medium"
        | "Enterprise",
      services,
      experienceLevel: experienceRaw
        ? (experienceRaw as "new" | "some" | "experienced" | "highly_experienced")
        : null,
      deviceFingerprint:
        typeof window !== "undefined"
          ? window.localStorage.getItem("bidvera_device") ?? undefined
          : undefined,
      turnstileToken: turnstileToken || undefined,
    };
    startTransition(async () => {
      const result = await completeCompanyOnboarding(payload);
      if (!result.ok) {
        setError(result.error.message);
        setTurnstileReset((n) => n + 1);
        return;
      }
      router.push(result.data.redirectTo);
      router.refresh();
    });
  }

  function onSkip() {
    setError(null);
    startTransition(async () => {
      const result = await skipCompanyOnboarding({
        turnstileToken: turnstileToken || undefined,
      });
      if (!result.ok) {
        setError(result.error.message);
        setTurnstileReset((n) => n + 1);
        return;
      }
      router.push(result.data.redirectTo);
      router.refresh();
    });
  }

  return (
    <Card className="mx-auto max-w-lg shadow-[var(--shadow-lift)]">
      <CardHeader>
        <CardTitle>{copy.title}</CardTitle>
        <CardDescription>{copy.body}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={onSubmit}>
          <Input
            name="companyName"
            label={copy.companyName}
            required
            autoComplete="organization"
          />

          <div className="space-y-1.5">
            <label htmlFor="industry" className="block text-sm font-medium text-foreground">
              {copy.industry}
            </label>
            <select
              id="industry"
              required
              className={selectClass}
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
            >
              <option value="" disabled>
                —
              </option>
              {INDUSTRY_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            {industry === "Other" ? (
              <Input
                name="industryOther"
                label="Describe your industry"
                required
                value={industryOther}
                onChange={(e) => setIndustryOther(e.target.value)}
              />
            ) : null}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="companySize" className="block text-sm font-medium text-foreground">
              {copy.companySize}
            </label>
            <select id="companySize" name="companySize" required className={selectClass} defaultValue="">
              <option value="" disabled>
                —
              </option>
              {COMPANY_SIZE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="serviceDraft" className="block text-sm font-medium text-foreground">
              {copy.services}
            </label>
            <p className="text-xs text-muted">{copy.servicesHint}</p>
            <div className="flex flex-wrap gap-2 rounded-xl border border-border bg-background px-2 py-2">
              {services.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-lg bg-primary-muted px-2 py-1 text-xs font-medium text-primary"
                >
                  {tag}
                  <button
                    type="button"
                    className="rounded p-0.5 hover:bg-primary/15"
                    aria-label={`Remove ${tag}`}
                    onClick={() => setServices((prev) => prev.filter((s) => s !== tag))}
                  >
                    <X className="size-3" aria-hidden />
                  </button>
                </span>
              ))}
              <input
                id="serviceDraft"
                value={serviceDraft}
                onChange={(e) => setServiceDraft(e.target.value)}
                onKeyDown={onServiceKeyDown}
                onBlur={() => addService(serviceDraft)}
                placeholder="Type and press Enter"
                className="min-w-[8rem] flex-1 bg-transparent px-1 py-1 text-sm outline-none placeholder:text-muted"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="country" className="block text-sm font-medium text-foreground">
              {copy.country}
            </label>
            <select id="country" name="country" required className={selectClass} defaultValue="">
              <option value="" disabled>
                —
              </option>
              {COUNTRY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="experienceLevel" className="block text-sm font-medium text-foreground">
              {copy.experience}{" "}
              <span className="font-normal text-muted">({copy.experienceOptional})</span>
            </label>
            <select
              id="experienceLevel"
              name="experienceLevel"
              className={selectClass}
              defaultValue=""
            >
              <option value="">—</option>
              {EXPERIENCE_LEVEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <p className="rounded-xl border border-border/80 bg-background px-3 py-2.5 text-xs leading-relaxed text-muted">
            {copy.privacyNote}
          </p>

          {error ? <p className="text-sm text-danger">{error}</p> : null}

          <TurnstileField
            siteKey={turnstileSiteKey}
            action="trial"
            onToken={setTurnstileToken}
            resetKey={turnstileReset}
          />

          <Button type="submit" className="w-full" loading={pending}>
            {copy.companySubmit}
          </Button>
          <button
            type="button"
            disabled={pending}
            onClick={onSkip}
            className="w-full text-center text-sm font-medium text-muted hover:text-foreground disabled:opacity-60"
          >
            {copy.companySkip}
          </button>
        </form>
      </CardContent>
    </Card>
  );
}
