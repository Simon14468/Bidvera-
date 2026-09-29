"use client";

import { completeCompanyOnboarding, skipCompanyOnboarding } from "@/app/actions";
import {
  COMPANY_SIZE_OPTIONS,
  EXPERIENCE_LEVEL_OPTIONS,
} from "@/config/company-options";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CountryFlag } from "@/components/ui/country-flag";
import { Input } from "@/components/ui/input";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { TurnstileField } from "@/components/security/turnstile-field";
import type { Locale } from "@/i18n/config";
import { getCompanyIndustryCopy, getCompanyIndustryOptions } from "@/i18n/company-industries";
import { getCountryOptions, getCountryUiCopy } from "@/i18n/countries";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, KeyboardEvent, useMemo, useState, useTransition } from "react";

const selectClass =
  "box-border h-11 w-full max-w-full min-w-0 rounded-xl border border-border bg-card px-3 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-10 sm:text-sm";

const fieldInputClass =
  "h-11 text-base sm:h-10 sm:text-sm";

export function CompanyOnboardingForm({
  copy,
  locale,
  turnstileSiteKey,
}: {
  turnstileSiteKey?: string | null;
  locale: Locale;
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
  const [country, setCountry] = useState("");
  const [services, setServices] = useState<string[]>([]);
  const [serviceDraft, setServiceDraft] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileReset, setTurnstileReset] = useState(0);

  const industryCopy = useMemo(() => getCompanyIndustryCopy(locale), [locale]);
  const industryOptions = useMemo(
    () => getCompanyIndustryOptions(locale),
    [locale],
  );
  const countryCopy = useMemo(() => getCountryUiCopy(locale), [locale]);
  const countryOptions = useMemo(
    () =>
      getCountryOptions(locale).map((c) => ({
        value: c.value,
        label: c.label,
        searchText: c.searchText,
        leading: <CountryFlag code={c.value} title={c.label} />,
      })),
    [locale],
  );

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
    const resolvedIndustry = industry.trim();
    if (!resolvedIndustry) {
      setError(industryCopy.required);
      return;
    }
    const resolvedCountry = country.trim();
    if (!resolvedCountry) {
      setError(countryCopy.required);
      return;
    }
    if (services.length === 0) {
      setError("Add at least one service or capability.");
      return;
    }
    const experienceRaw = String(fd.get("experienceLevel") ?? "");
    const payload = {
      companyName: String(fd.get("companyName") ?? "").trim(),
      country: resolvedCountry,
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
    <Card className="mx-auto w-full min-w-0 max-w-lg overflow-visible shadow-[var(--shadow-lift)]">
      <CardHeader className="px-4 pt-4 pb-2 sm:px-5 sm:pt-5 sm:pb-3">
        <CardTitle className="break-words text-lg sm:text-base">
          {copy.title}
        </CardTitle>
        <CardDescription className="break-words">{copy.body}</CardDescription>
      </CardHeader>
      <CardContent className="overflow-visible px-4 pb-4 sm:px-5 sm:pb-5">
        <form className="grid min-w-0 gap-3.5 sm:gap-4" onSubmit={onSubmit}>
          <Input
            name="companyName"
            label={copy.companyName}
            required
            autoComplete="organization"
            className={fieldInputClass}
          />

          <SearchableCombobox
            id="industry"
            label={copy.industry}
            value={industry}
            options={industryOptions}
            onChange={setIndustry}
            placeholder={industryCopy.placeholder}
            searchPlaceholder={industryCopy.searchPlaceholder}
            emptyMessage={industryCopy.empty}
            required
          />

          <div className="min-w-0 space-y-1.5">
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

          <div className="min-w-0 space-y-1.5">
            <label htmlFor="serviceDraft" className="block text-sm font-medium text-foreground">
              {copy.services}
            </label>
            <p className="break-words text-xs text-muted">{copy.servicesHint}</p>
            <div className="flex min-w-0 flex-wrap gap-2 rounded-xl border border-border bg-background px-2 py-2">
              {services.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex max-w-full items-center gap-1 rounded-lg bg-primary-muted px-2 py-1.5 text-xs font-medium text-primary"
                >
                  <span className="min-w-0 break-words">{tag}</span>
                  <button
                    type="button"
                    className="inline-flex size-7 shrink-0 items-center justify-center rounded-md hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`Remove ${tag}`}
                    onClick={() => setServices((prev) => prev.filter((s) => s !== tag))}
                  >
                    <X className="size-3.5" aria-hidden />
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
                className="min-h-11 min-w-0 flex-1 basis-full bg-transparent px-1 py-1 text-base outline-none placeholder:text-muted sm:min-h-0 sm:basis-[8rem] sm:text-sm"
              />
            </div>
          </div>

          <SearchableCombobox
            id="country"
            label={copy.country}
            value={country}
            options={countryOptions}
            onChange={setCountry}
            placeholder={countryCopy.placeholder}
            searchPlaceholder={countryCopy.searchPlaceholder}
            emptyMessage={countryCopy.empty}
            required
          />

          <div className="min-w-0 space-y-1.5">
            <label htmlFor="experienceLevel" className="block break-words text-sm font-medium text-foreground">
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

          <p className="break-words rounded-xl border border-border/80 bg-background px-3 py-2.5 text-xs leading-relaxed text-muted">
            {copy.privacyNote}
          </p>

          {error ? (
            <p className="break-words text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}

          <div className="min-w-0 overflow-x-auto">
            <TurnstileField
              siteKey={turnstileSiteKey}
              action="trial"
              onToken={setTurnstileToken}
              resetKey={turnstileReset}
            />
          </div>

          <Button type="submit" className="h-11 w-full text-base sm:h-10 sm:text-sm" loading={pending}>
            {copy.companySubmit}
          </Button>
          <button
            type="button"
            disabled={pending}
            onClick={onSkip}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl px-3 text-center text-sm font-medium text-muted transition hover:bg-foreground/[0.04] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60"
          >
            {copy.companySkip}
          </button>
        </form>
      </CardContent>
    </Card>
  );
}
