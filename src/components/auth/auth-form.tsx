"use client";

import {
  forgotPassword,
  login,
  resetPassword,
  signup,
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TurnstileField } from "@/components/security/turnstile-field";
import type { Dictionary } from "@/i18n/dictionaries";
import { safeInternalPath } from "@/domain/security/safe-redirect";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";

type AuthLabels = Dictionary["auth"] & { signIn: string; startFree: string };

function deviceFp() {
  if (typeof window === "undefined") return undefined;
  const existing = window.localStorage.getItem("bidvera_device");
  if (existing) return existing;
  const id = crypto.randomUUID();
  window.localStorage.setItem("bidvera_device", id);
  return id;
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62Z" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z" />
    </svg>
  );
}

function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M3 3h8.5v8.5H3V3Zm9.5 0H21v8.5h-8.5V3ZM3 12.5H11.5V21H3v-8.5Zm9.5 0H21V21h-8.5v-8.5Z" />
    </svg>
  );
}

const oauthBtnClass =
  "mt-3 flex h-10 w-full items-center justify-center gap-2.5 rounded-xl border border-border bg-[#1a1a1a] text-sm font-medium text-white transition hover:bg-[#2a2a2a] disabled:cursor-not-allowed disabled:opacity-60";

export function AuthForm({
  mode,
  labels,
  googleEnabled = false,
  microsoftEnabled = false,
  registrationEnabled = true,
  turnstileSiteKey,
}: {
  mode: "login" | "signup";
  labels: AuthLabels;
  googleEnabled?: boolean;
  microsoftEnabled?: boolean;
  /** When false, hide signup CTAs on the login screen. */
  registrationEnabled?: boolean;
  turnstileSiteKey?: string | null;
}) {
  const router = useRouter();
  const search = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileReset, setTurnstileReset] = useState(0);
  const showOAuth = googleEnabled || microsoftEnabled;
  const nextPath = safeInternalPath(search.get("next"), "/dashboard");
  const oauthErrorParam = search.get("oauth_error");
  const oauthMessageParam = search.get("oauth_message");
  const oauthError =
    oauthErrorParam || oauthMessageParam
      ? oauthMessageParam?.trim() || labels.googleOAuthError
      : null;

  function googleStartHref() {
    const q = new URLSearchParams();
    if (nextPath && nextPath !== "/dashboard") q.set("next", nextPath);
    const qs = q.toString();
    return qs ? `/api/auth/google/start?${qs}` : "/api/auth/google/start";
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "");
    const password = String(fd.get("password") ?? "");
    const acceptTerms = fd.get("acceptTerms") === "on";

    startTransition(async () => {
      if (mode === "signup" && !acceptTerms) {
        setError(labels.acceptTermsError);
        return;
      }
      const result =
        mode === "signup"
          ? await signup({
              email,
              password,
              acceptTerms: true as const,
              deviceFingerprint: deviceFp(),
              turnstileToken: turnstileToken || undefined,
            })
          : await login({
              email,
              password,
              deviceFingerprint: deviceFp(),
              turnstileToken: turnstileToken || undefined,
            });
      if (!result.ok) {
        setError(result.error.message);
        setTurnstileReset((n) => n + 1);
        return;
      }
      const serverRedirect =
        result.data && "redirectTo" in result.data
          ? String(result.data.redirectTo)
          : null;
      const redirectTo = safeInternalPath(
        serverRedirect ?? search.get("next"),
        "/dashboard",
      );
      router.push(redirectTo);
      router.refresh();
    });
  }

  return (
    <Card className="mx-auto w-full max-w-md animate-scale-in shadow-[var(--shadow-lift)]">
      <CardHeader>
        <CardTitle>
          {mode === "signup" ? labels.signupTitle : labels.loginTitle}
        </CardTitle>
        {mode === "signup" ? (
          <CardDescription>{labels.signupBody}</CardDescription>
        ) : search.get("notice") === "email-changed" ? (
          <CardDescription>{labels.emailChangedNotice}</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent>
        <form id="auth-form" className="space-y-4" onSubmit={onSubmit}>
          <Input
            name="email"
            type="email"
            label={labels.email}
            required
            autoComplete="email"
          />
          {mode === "signup" ? (
            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-sm font-medium text-foreground">
                {labels.password}
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="flex h-10 w-full rounded-xl border border-border bg-background py-2 pe-11 ps-3 text-sm text-foreground placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-e-1.5 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted transition hover:bg-foreground/[0.06] hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="size-4" aria-hidden />
                  ) : (
                    <Eye className="size-4" aria-hidden />
                  )}
                </button>
              </div>
            </div>
          ) : (
            <Input
              name="password"
              type="password"
              label={labels.password}
              required
              minLength={8}
              autoComplete="current-password"
            />
          )}
          {mode === "signup" ? (
            <label className="flex items-start gap-2 text-sm text-muted">
              <input
                type="checkbox"
                name="acceptTerms"
                required
                className="mt-1 h-4 w-4 rounded border-border"
              />
              <span>
                {labels.acceptTermsLead}{" "}
                <Link
                  href="/terms-of-service"
                  className="font-medium text-primary hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {labels.termsOfServiceLink}
                </Link>{" "}
                {labels.acceptTermsJoiner}{" "}
                <Link
                  href="/privacy-policy"
                  className="font-medium text-primary hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {labels.privacyPolicyLink}
                </Link>
                .
              </span>
            </label>
          ) : null}
          {error || oauthError ? (
            <p className="text-sm text-danger">{error ?? oauthError}</p>
          ) : null}
          <TurnstileField
            siteKey={turnstileSiteKey}
            action={mode === "signup" ? "signup" : "login"}
            onToken={setTurnstileToken}
            resetKey={turnstileReset}
          />
          <Button type="submit" className="w-full" loading={pending}>
            {mode === "signup" ? labels.submitSignup : labels.submitLogin}
          </Button>
        </form>
        {showOAuth ? (
          <div className="mt-3 space-y-2">
            {googleEnabled ? (
              <a
                href={googleStartHref()}
                className={oauthBtnClass}
                aria-label={labels.continueGoogle}
              >
                <GoogleIcon className="size-4 shrink-0 text-white" />
                <span>{labels.continueGoogle}</span>
              </a>
            ) : null}
            {microsoftEnabled ? (
              <button
                type="button"
                disabled
                className={`${oauthBtnClass} cursor-not-allowed opacity-60`}
                title={labels.microsoftComingSoon}
                aria-disabled="true"
              >
                <MicrosoftIcon className="size-4 shrink-0 text-white" />
                <span>{labels.microsoftComingSoon}</span>
              </button>
            ) : null}
          </div>
        ) : null}
        {mode === "login" ? (
          <p className="mt-3 text-center text-sm">
            <Link href="/forgot-password" className="text-primary hover:underline">
              {labels.forgotPassword}
            </Link>
          </p>
        ) : null}
        <p className="mt-4 text-center text-sm text-muted">
          {mode === "signup" ? (
            <>
              {labels.haveAccount}{" "}
              <Link href="/login" className="font-medium text-primary hover:underline">
                {labels.signIn}
              </Link>
            </>
          ) : registrationEnabled ? (
            <>
              {labels.newHere}{" "}
              <Link href="/signup" className="font-medium text-primary hover:underline">
                {labels.startFree}
              </Link>
            </>
          ) : null}
        </p>
      </CardContent>
    </Card>
  );
}

export function ForgotPasswordForm({
  labels,
  turnstileSiteKey,
}: {
  labels: AuthLabels;
  turnstileSiteKey?: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileReset, setTurnstileReset] = useState(0);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await forgotPassword({
        email: String(fd.get("email") ?? ""),
        turnstileToken: turnstileToken || undefined,
      });
      if (!result.ok) {
        setError(result.error.message);
        setTurnstileReset((n) => n + 1);
        return;
      }
      setDone(true);
    });
  }

  return (
    <Card className="mx-auto w-full max-w-md shadow-[var(--shadow-lift)]">
      <CardHeader>
        <CardTitle>{labels.forgotTitle}</CardTitle>
        <CardDescription>{labels.forgotBody}</CardDescription>
      </CardHeader>
      <CardContent>
        {done ? (
          <p className="text-sm text-muted">{labels.forgotSent}</p>
        ) : (
          <form className="space-y-4" onSubmit={onSubmit}>
            <Input name="email" type="email" label={labels.email} required />
            {error ? <p className="text-sm text-danger">{error}</p> : null}
            <TurnstileField
              siteKey={turnstileSiteKey}
              action="forgot-password"
              onToken={setTurnstileToken}
              resetKey={turnstileReset}
            />
            <Button type="submit" className="w-full" loading={pending}>
              {labels.forgotSubmit}
            </Button>
          </form>
        )}
        <p className="mt-4 text-center text-sm">
          <Link href="/login" className="text-primary hover:underline">
            {labels.signIn}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

export function ResetPasswordForm({
  labels,
  token,
  turnstileSiteKey,
}: {
  labels: AuthLabels;
  token: string;
  turnstileSiteKey?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileReset, setTurnstileReset] = useState(0);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password") ?? "");
    const confirm = String(fd.get("confirm") ?? "");
    if (password !== confirm) {
      setError(labels.passwordMismatch);
      return;
    }
    startTransition(async () => {
      const result = await resetPassword({
        token,
        password,
        turnstileToken: turnstileToken || undefined,
      });
      if (!result.ok) {
        setError(result.error.message);
        setTurnstileReset((n) => n + 1);
        return;
      }
      router.push("/login");
      router.refresh();
    });
  }

  return (
    <Card className="mx-auto w-full max-w-md shadow-[var(--shadow-lift)]">
      <CardHeader>
        <CardTitle>{labels.resetTitle}</CardTitle>
        <CardDescription>{labels.resetBody}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          <Input
            name="password"
            type="password"
            label={labels.password}
            required
            minLength={8}
            autoComplete="new-password"
          />
          <Input
            name="confirm"
            type="password"
            label={labels.confirmPassword}
            required
            minLength={8}
            autoComplete="new-password"
          />
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <TurnstileField
            siteKey={turnstileSiteKey}
            action="reset-password"
            onToken={setTurnstileToken}
            resetKey={turnstileReset}
          />
          <Button type="submit" className="w-full" loading={pending}>
            {labels.resetSubmit}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
