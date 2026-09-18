"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { SupplierQualificationProfileDto } from "@/modules/supplier-qualification";

function listToText(values: string[]): string {
  return values.join("\n");
}

function textToList(value: string): string[] {
  return value
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function SupplierProfileEditor({
  initial,
  mode = "full",
}: {
  initial: SupplierQualificationProfileDto;
  mode?: "full" | "qualifications" | "services" | "coverage";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState(initial);

  function setField<K extends keyof SupplierQualificationProfileDto>(
    key: K,
    value: SupplierQualificationProfileDto[K],
  ) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function onSave() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const payload: Record<string, unknown> = {};
      if (mode === "full") {
        Object.assign(payload, {
          legalCompanyName: form.legalCompanyName,
          tradingName: form.tradingName,
          registrationNumber: form.registrationNumber,
          taxVatNumber: form.taxVatNumber,
          country: form.country,
          addressLine1: form.addressLine1,
          addressLine2: form.addressLine2,
          city: form.city,
          region: form.region,
          postalCode: form.postalCode,
          contactName: form.contactName,
          contactEmail: form.contactEmail,
          contactPhone: form.contactPhone,
          website: form.website,
          companyType: form.companyType,
          yearEstablished: form.yearEstablished,
          employeeCount: form.employeeCount,
          annualTurnover: form.annualTurnover,
          currencies: form.currencies,
          languages: form.languages,
          notes: form.notes,
        });
      }
      if (mode === "full" || mode === "qualifications") {
        Object.assign(payload, {
          certifications: form.certifications,
          licenses: form.licenses,
        });
      }
      if (mode === "full" || mode === "services") {
        Object.assign(payload, {
          businessSectors: form.businessSectors,
          servicesProducts: form.servicesProducts,
        });
      }
      if (mode === "full" || mode === "coverage") {
        Object.assign(payload, {
          geographicCoverage: form.geographicCoverage,
          currencies: form.currencies,
          languages: form.languages,
        });
      }

      const res = await fetch("/api/supplier-qualification/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        profile?: SupplierQualificationProfileDto;
      };
      if (!res.ok) {
        setError(json.error ?? "Save failed.");
        return;
      }
      if (json.profile) setForm(json.profile);
      setMessage(`Saved · completeness ${json.profile?.completenessPercent ?? "?"}%`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {mode === "full" ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Legal company name"
              value={form.legalCompanyName ?? ""}
              onChange={(v) => setField("legalCompanyName", v || null)}
            />
            <Field
              label="Trading name"
              value={form.tradingName ?? ""}
              onChange={(v) => setField("tradingName", v || null)}
            />
            <Field
              label="Registration number"
              value={form.registrationNumber ?? ""}
              onChange={(v) => setField("registrationNumber", v || null)}
            />
            <Field
              label="Tax / VAT number"
              value={form.taxVatNumber ?? ""}
              onChange={(v) => setField("taxVatNumber", v || null)}
            />
            <Field
              label="Country"
              value={form.country ?? ""}
              onChange={(v) => setField("country", v || null)}
            />
            <Field
              label="Company type"
              value={form.companyType ?? ""}
              onChange={(v) => setField("companyType", v || null)}
            />
            <Field
              label="Year established"
              type="number"
              value={form.yearEstablished?.toString() ?? ""}
              onChange={(v) =>
                setField("yearEstablished", v ? Number(v) : null)
              }
            />
            <Field
              label="Employee count"
              type="number"
              value={form.employeeCount?.toString() ?? ""}
              onChange={(v) =>
                setField("employeeCount", v ? Number(v) : null)
              }
            />
            <Field
              label="Annual turnover"
              value={form.annualTurnover ?? ""}
              onChange={(v) => setField("annualTurnover", v || null)}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Address line 1"
              value={form.addressLine1 ?? ""}
              onChange={(v) => setField("addressLine1", v || null)}
            />
            <Field
              label="Address line 2"
              value={form.addressLine2 ?? ""}
              onChange={(v) => setField("addressLine2", v || null)}
            />
            <Field
              label="City"
              value={form.city ?? ""}
              onChange={(v) => setField("city", v || null)}
            />
            <Field
              label="Region / state"
              value={form.region ?? ""}
              onChange={(v) => setField("region", v || null)}
            />
            <Field
              label="Postal code"
              value={form.postalCode ?? ""}
              onChange={(v) => setField("postalCode", v || null)}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Contact name"
              value={form.contactName ?? ""}
              onChange={(v) => setField("contactName", v || null)}
            />
            <Field
              label="Contact email"
              value={form.contactEmail ?? ""}
              onChange={(v) => setField("contactEmail", v || null)}
            />
            <Field
              label="Contact phone"
              value={form.contactPhone ?? ""}
              onChange={(v) => setField("contactPhone", v || null)}
            />
            <Field
              label="Website"
              value={form.website ?? ""}
              onChange={(v) => setField("website", v || null)}
            />
          </div>
          <Area
            label="Notes"
            value={form.notes ?? ""}
            onChange={(v) => setField("notes", v || null)}
          />
        </>
      ) : null}

      {mode === "qualifications" || mode === "full" ? (
        <>
          <Area
            label="Certifications (one per line)"
            value={listToText(form.certifications)}
            onChange={(v) => setField("certifications", textToList(v))}
          />
          <Area
            label="Licenses (one per line)"
            value={listToText(form.licenses)}
            onChange={(v) => setField("licenses", textToList(v))}
          />
        </>
      ) : null}

      {mode === "services" || mode === "full" ? (
        <>
          <Area
            label="Business sectors (custom allowed)"
            value={listToText(form.businessSectors)}
            onChange={(v) => setField("businessSectors", textToList(v))}
          />
          <Area
            label="Services / products (custom allowed)"
            value={listToText(form.servicesProducts)}
            onChange={(v) => setField("servicesProducts", textToList(v))}
          />
        </>
      ) : null}

      {mode === "coverage" || mode === "full" ? (
        <>
          <Area
            label="Geographic coverage"
            value={listToText(form.geographicCoverage)}
            onChange={(v) => setField("geographicCoverage", textToList(v))}
          />
          <Area
            label="Currencies"
            value={listToText(form.currencies)}
            onChange={(v) => setField("currencies", textToList(v))}
          />
          <Area
            label="Languages"
            value={listToText(form.languages)}
            onChange={(v) => setField("languages", textToList(v))}
          />
        </>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {message ? <p className="text-sm text-muted">{message}</p> : null}
      <button
        type="button"
        onClick={onSave}
        disabled={pending}
        className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
      />
    </label>
  );
}

function Area({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
      />
    </label>
  );
}
