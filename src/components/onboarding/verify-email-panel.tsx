"use client";

import { resendVerification } from "@/app/actions";
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
        {message ? <p className="text-sm text-success">{message}</p> : null}
        {error ? <p className="text-sm text-danger">{error}</p> : null}
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
