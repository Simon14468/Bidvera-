import { AppError, ErrorCode } from "@/lib/errors";

export function hasBillingWebhookSignatureHeaders(headers: Headers): boolean {
  return Boolean(
    headers.get("stripe-signature") ||
      headers.get("paypal-transmission-id") ||
      headers.get("paypal-auth-algo"),
  );
}

export function assertBillingWebhookSignatureHeaders(headers: Headers): void {
  if (!hasBillingWebhookSignatureHeaders(headers)) {
    throw new AppError(
      ErrorCode.VALIDATION,
      "Missing webhook signature headers.",
      400,
    );
  }
}
