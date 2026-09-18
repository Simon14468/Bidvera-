/**
 * Resolve AUTH_SECRET for HMAC / vault encryption.
 * Production refuses to start crypto with a missing or weak secret.
 */
export function getAuthSecret(): string {
  const secret = (process.env.AUTH_SECRET ?? "").trim();
  if (process.env.NODE_ENV === "production") {
    if (secret.length < 32) {
      throw new Error(
        "AUTH_SECRET must be set to a random string of at least 32 characters in production.",
      );
    }
    return secret;
  }
  return secret.length >= 16 ? secret : "dev-insecure-secret";
}
