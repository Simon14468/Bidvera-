"use client";

import { setGlobalLearningConsentAction } from "@/app/actions";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { SettingsToggleRow } from "@/components/ui/settings-toggle-row";
import type { Dictionary } from "@/i18n/dictionaries";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function LearningConsentCard({
  initialConsent,
  copy,
}: {
  initialConsent: boolean;
  copy: Pick<
    Dictionary["app"]["companyProfile"],
    "learningTitle" | "learningBody" | "learningCheckbox" | "learningSaving"
  >;
}) {
  const router = useRouter();
  const [consent, setConsent] = useState(initialConsent);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Card>
      <CardContent className="space-y-3 pt-5">
        <h2 className="text-sm font-semibold tracking-tight">{copy.learningTitle}</h2>
        <p className="text-xs leading-relaxed text-muted">{copy.learningBody}</p>
        <SettingsToggleRow
          label={`${copy.learningCheckbox}${pending ? ` ${copy.learningSaving}` : ""}`}
          checked={consent}
          disabled={pending}
          onCheckedChange={(next) => {
            setConsent(next);
            setError(null);
            startTransition(async () => {
              const res = await setGlobalLearningConsentAction(next);
              if (!res.ok) {
                setConsent(!next);
                setError(res.error.message);
                return;
              }
              router.refresh();
            });
          }}
        />
        {error ? (
          <Alert variant="danger" title="Couldn’t update preference">
            {error}
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}
