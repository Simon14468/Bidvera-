"use client";

import { resendVerification } from "@/app/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useState, useTransition } from "react";

export function VerifyEmailPanel({
  email,
  copy,
}: {
  email: string;
  copy: {
    title: string;
    body: string;
    resend: string;
    resent: string;
  };
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <Card className="mx-auto max-w-lg shadow-[var(--shadow-lift)]">
      <CardHeader>
        <CardTitle>{copy.title}</CardTitle>
        <CardDescription>
          {copy.body} <span className="font-medium text-foreground">{email}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {message ? (
          <Alert variant="success" title="Sent">
            {message}
          </Alert>
        ) : null}
        {error ? (
          <Alert variant="danger" title="Couldn’t resend">
            {error}
          </Alert>
        ) : null}
        <Button
          type="button"
          variant="outline"
          loading={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await resendVerification();
              if (!result.ok) {
                setError(result.error.message);
                return;
              }
              setMessage(copy.resent);
            });
          }}
        >
          {copy.resend}
        </Button>
      </CardContent>
    </Card>
  );
}
