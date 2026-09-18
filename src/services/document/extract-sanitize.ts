/**
 * Shared text sanitation for native + OCR extractors.
 * Never used to reinterpret PDF binary as document text.
 * Never truncates length — the authoritative corpus stays complete.
 */
export function sanitizeExtractedText(raw: string): string {
  return raw
    .replace(/\u0000/g, "")
    .replace(/[\uD800-\uDFFF]/g, "")
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F]/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function looksLikeBinaryGarbage(text: string): boolean {
  const sample = text.slice(0, 2000);
  if (/^%PDF-/i.test(sample.trim())) return true;
  if (/PK\u0003\u0004/.test(sample.slice(0, 8))) return true;
  const bad = (sample.match(/\uFFFD|[\u0000-\u0008\u000E-\u001F]/g) ?? []).length;
  if (sample.length > 40 && bad / sample.length > 0.08) return true;
  return false;
}
