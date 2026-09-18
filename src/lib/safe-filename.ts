/**
 * Sanitize a user-supplied filename for Content-Disposition.
 * Strips path segments, control characters, and header-breaking bytes.
 */
export function safeContentDispositionFilename(
  name: string,
  fallback = "download",
): string {
  const base = name.split(/[/\\]/).pop() ?? name;
  const cleaned = base
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[\r\n"\\]/g, "_")
    .trim()
    .slice(0, 180);
  return cleaned || fallback;
}
