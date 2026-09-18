import { hashIdentifier } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import type { TrialRiskVerdict } from "@prisma/client";

export interface TrialRiskInput {
  email: string;
  companyName: string;
  companyDomain?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  deviceFingerprint?: string | null;
  emailVerified?: boolean;
  hasPaymentIdentity?: boolean;
  /** Stripe payment-method fingerprint (never a PAN). */
  paymentFingerprint?: string | null;
}

export interface TrialRiskResult {
  score: number;
  verdict: TrialRiskVerdict;
  signals: Record<string, number | boolean | string>;
}

/**
 * Progressive trial-risk layer.
 * Single signals never hard-block; combined score drives ALLOW / STEP_UP / REVIEW / BLOCK.
 */
export async function assessTrialRisk(input: TrialRiskInput): Promise<TrialRiskResult> {
  const emailHash = hashIdentifier(input.email)!;
  const domain =
    input.companyDomain ??
    input.email.split("@")[1]?.toLowerCase() ??
    null;
  const ipHash = hashIdentifier(input.ip);
  const deviceHash = hashIdentifier(input.deviceFingerprint ?? input.userAgent);

  const signals: Record<string, number | boolean | string> = {};
  let score = 0;

  if (!input.emailVerified) {
    score += 15;
    signals.unverifiedEmail = true;
  } else {
    signals.verifiedEmail = true;
  }

  const disposable = isDisposableDomain(domain);
  if (disposable) {
    score += 35;
    signals.disposableDomain = true;
  }

  if (!input.companyName || input.companyName.trim().length < 3) {
    score += 20;
    signals.weakCompanyName = true;
  }

  const priorEmail = await prisma.trialRiskSignal.count({
    where: { emailHash, createdAt: { gte: daysAgo(90) } },
  });
  if (priorEmail > 0) {
    score += 25;
    signals.priorEmailTrial = priorEmail;
  }

  if (domain) {
    const priorDomain = await prisma.company.count({
      where: { domain, createdAt: { gte: daysAgo(180) } },
    });
    if (priorDomain > 0) {
      score += 20;
      signals.priorDomainCompany = priorDomain;
    }
  }

  if (ipHash) {
    const ipVelocity = await prisma.trialRiskSignal.count({
      where: { ipHash, createdAt: { gte: daysAgo(1) } },
    });
    if (ipVelocity >= 5) {
      score += 30;
      signals.ipVelocity = ipVelocity;
    } else if (ipVelocity >= 2) {
      score += 10;
      signals.ipVelocity = ipVelocity;
    }
  }

  if (deviceHash) {
    const deviceVelocity = await prisma.trialRiskSignal.count({
      where: { deviceHash, createdAt: { gte: daysAgo(7) } },
    });
    if (deviceVelocity >= 3) {
      score += 25;
      signals.deviceVelocity = deviceVelocity;
    }
  }

  const paymentFingerprintHash = hashIdentifier(input.paymentFingerprint);
  const hasPaymentIdentity = Boolean(input.hasPaymentIdentity || paymentFingerprintHash);
  if (hasPaymentIdentity) {
    score = Math.max(0, score - 20);
    signals.paymentIdentity = true;
  }

  if (paymentFingerprintHash) {
    const priorPayment = await prisma.trialRiskSignal.count({
      where: {
        paymentFingerprintHash,
        createdAt: { gte: daysAgo(365) },
      },
    });
    if (priorPayment > 0) {
      score += 50;
      signals.priorPaymentTrial = priorPayment;
    }
  }

  const verdict: TrialRiskVerdict =
    score >= 80 ? "BLOCK" : score >= 55 ? "REVIEW" : score >= 30 ? "STEP_UP" : "ALLOW";

  signals.score = score;
  signals.verdict = verdict;

  return { score, verdict, signals };
}

export async function persistTrialRisk(input: {
  companyId?: string;
  email: string;
  domain?: string | null;
  ip?: string | null;
  deviceFingerprint?: string | null;
  paymentFingerprint?: string | null;
  result: TrialRiskResult;
}) {
  await prisma.trialRiskSignal.create({
    data: {
      companyId: input.companyId,
      emailHash: hashIdentifier(input.email),
      domain: input.domain ?? null,
      ipHash: hashIdentifier(input.ip),
      deviceHash: hashIdentifier(input.deviceFingerprint),
      paymentFingerprintHash: hashIdentifier(input.paymentFingerprint),
      score: input.result.score,
      verdict: input.result.verdict,
      signals: input.result.signals,
    },
  });
}

export async function paymentIdentityHasConsumedTrial(
  paymentFingerprint: string | null | undefined,
  excludeCompanyId?: string | null,
): Promise<boolean> {
  const paymentFingerprintHash = hashIdentifier(paymentFingerprint);
  if (!paymentFingerprintHash) return false;
  const prior = await prisma.trialRiskSignal.count({
    where: {
      paymentFingerprintHash,
      createdAt: { gte: daysAgo(365) },
      ...(excludeCompanyId ? { NOT: { companyId: excludeCompanyId } } : {}),
    },
  });
  return prior > 0;
}

export async function assertPaymentIdentityAllowsTrial(
  paymentFingerprint: string | null | undefined,
  excludeCompanyId?: string | null,
) {
  if (await paymentIdentityHasConsumedTrial(paymentFingerprint, excludeCompanyId)) {
    throw new AppError(
      ErrorCode.TRIAL_RISK,
      "A free trial has already been used with this payment method.",
      403,
      { reason: "payment_identity_consumed" },
    );
  }
}

/** IP/office velocity alone must never reach BLOCK. */
export function ipVelocityScore(ipVelocity: number): number {
  if (ipVelocity >= 5) return 30;
  if (ipVelocity >= 2) return 10;
  return 0;
}

export function assertTrialAllowed(result: TrialRiskResult) {
  if (result.verdict === "BLOCK") {
    throw new AppError(
      ErrorCode.TRIAL_RISK,
      "We couldn’t start a trial for this signup. Contact support if this looks wrong.",
      403,
      { verdict: result.verdict },
    );
  }
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function isDisposableDomain(domain: string | null): boolean {
  if (!domain) return false;
  const block = [
    "mailinator.com",
    "guerrillamail.com",
    "tempmail.com",
    "10minutemail.com",
    "yopmail.com",
  ];
  return block.includes(domain);
}
