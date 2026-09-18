"use client";

import { updateCompanyProfile } from "@/app/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  COMPANY_SIZE_OPTIONS,
  EXPERIENCE_LEVEL_OPTIONS,
} from "@/config/company-options";
import type { Dictionary } from "@/i18n/dictionaries";
import { useState, useTransition } from "react";

export interface CompanyProfileFormState {
  industry: string | null;
  country: string | null;
  companySize: string | null;
  experienceLevel: string | null;
  services: string[];
  certifications: string[];
  experienceYears: number | null;
  revenueRange: string | null;
  employeeRange: string | null;
  geographicCoverage: string[];
  contractSizeMin: number | null;
  contractSizeMax: number | null;
  customQualificationRules: string[];
  completeness: number;
}

type Copy = Dictionary["app"]["companyProfile"];

function csv(value: string[]) {
  return value.join(", ");
}

function parseCsv(value: string) {
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function sizeLabel(value: string, copy: Copy) {
  switch (value) {
    case "Solo":
      return copy.sizeSolo;
    case "Small":
      return copy.sizeSmall;
    case "Medium":
      return copy.sizeMedium;
    case "Enterprise":
      return copy.sizeEnterprise;
    default:
      return value;
  }
}

function experienceLabel(value: string, copy: Copy) {
  switch (value) {
    case "new":
      return copy.expNew;
    case "some":
      return copy.expSome;
    case "experienced":
      return copy.expExperienced;
    case "highly_experienced":
      return copy.expHighly;
    default:
      return value;
  }
}

export function CompanyProfileForm({
  companyName,
  initial,
  copy,
}: {
  companyName: string;
  initial: CompanyProfileFormState;
  copy: Copy;
}) {
  const [name, setName] = useState(companyName);
  const [profile, setProfile] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function update<K extends keyof CompanyProfileFormState>(
    key: K,
    value: CompanyProfileFormState[K],
  ) {
    setProfile((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await updateCompanyProfile({
        name: name.trim() || undefined,
        industry: profile.industry,
        country: profile.country,
        companySize: profile.companySize,
        experienceLevel: profile.experienceLevel,
        services: profile.services,
        certifications: profile.certifications,
        experienceYears: profile.experienceYears,
        revenueRange: profile.revenueRange,
        employeeRange: profile.employeeRange,
        geographicCoverage: profile.geographicCoverage,
        contractSizeMin: profile.contractSizeMin,
        contractSizeMax: profile.contractSizeMax,
        customQualificationRules: profile.customQualificationRules,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setProfile((prev) => ({
        ...prev,
        completeness: result.data.completeness,
      }));
      setSaved(true);
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{name || companyName}</CardTitle>
          <CardDescription>{copy.headerHint}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            label={copy.companyName}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setSaved(false);
            }}
          />
          <Progress value={profile.completeness} label={copy.completeness} />
        </CardContent>
      </Card>

      {saved ? (
        <Alert variant="success" title={copy.savedTitle}>
          {copy.savedBody}
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="danger" title={copy.saveErrorTitle}>
          {error}
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{copy.basicsTitle}</CardTitle>
          <CardDescription>{copy.basicsBody}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Input
            label={copy.industry}
            value={profile.industry ?? ""}
            onChange={(e) => update("industry", e.target.value)}
          />
          <Input
            label={copy.country}
            value={profile.country ?? ""}
            onChange={(e) => update("country", e.target.value)}
          />
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium text-foreground">{copy.companySize}</span>
            <select
              className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              value={profile.companySize ?? ""}
              onChange={(e) => update("companySize", e.target.value || null)}
            >
              <option value="">{copy.notProvided}</option>
              {COMPANY_SIZE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {sizeLabel(o.value, copy)}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium text-foreground">{copy.experienceLevel}</span>
            <select
              className="h-10 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              value={profile.experienceLevel ?? ""}
              onChange={(e) => update("experienceLevel", e.target.value || null)}
            >
              <option value="">{copy.notProvided}</option>
              {EXPERIENCE_LEVEL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {experienceLabel(o.value, copy)}
                </option>
              ))}
            </select>
          </label>
          <Input
            label={copy.experienceYears}
            type="number"
            value={profile.experienceYears ?? ""}
            onChange={(e) =>
              update(
                "experienceYears",
                e.target.value === "" ? null : Number(e.target.value),
              )
            }
            placeholder={copy.experienceYearsPlaceholder}
          />
          <Input
            label={copy.revenueRange}
            value={profile.revenueRange ?? ""}
            onChange={(e) => update("revenueRange", e.target.value)}
            placeholder={copy.revenuePlaceholder}
          />
          <Input
            label={copy.employees}
            value={profile.employeeRange ?? ""}
            onChange={(e) => update("employeeRange", e.target.value)}
            placeholder={copy.employeesPlaceholder}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{copy.capabilitiesTitle}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Textarea
            label={copy.services}
            hint={copy.commaSeparated}
            value={csv(profile.services)}
            onChange={(e) => update("services", parseCsv(e.target.value))}
          />
          <Textarea
            label={copy.certifications}
            hint={copy.commaSeparated}
            value={csv(profile.certifications)}
            onChange={(e) => update("certifications", parseCsv(e.target.value))}
          />
          <Textarea
            label={copy.geographicCoverage}
            hint={copy.commaSeparated}
            value={csv(profile.geographicCoverage)}
            onChange={(e) => update("geographicCoverage", parseCsv(e.target.value))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{copy.contractTitle}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Input
            label={copy.contractMin}
            type="number"
            value={profile.contractSizeMin ?? ""}
            onChange={(e) =>
              update(
                "contractSizeMin",
                e.target.value === "" ? null : Number(e.target.value),
              )
            }
          />
          <Input
            label={copy.contractMax}
            type="number"
            value={profile.contractSizeMax ?? ""}
            onChange={(e) =>
              update(
                "contractSizeMax",
                e.target.value === "" ? null : Number(e.target.value),
              )
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{copy.rulesTitle}</CardTitle>
          <CardDescription>{copy.rulesBody}</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            rows={5}
            value={profile.customQualificationRules.join("\n")}
            onChange={(e) =>
              update(
                "customQualificationRules",
                e.target.value
                  .split("\n")
                  .map((v) => v.trim())
                  .filter(Boolean),
              )
            }
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} loading={pending}>
          {copy.save}
        </Button>
      </div>
    </div>
  );
}
