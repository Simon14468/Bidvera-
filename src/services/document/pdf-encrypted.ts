/**
 * Detect password-protected / encrypted PDFs without decoding their body as text.
 * Heuristic on PDF structure (does not invent page content).
 */
export function isPdfEncrypted(buffer: Buffer): boolean {
  if (buffer.length < 8) return false;
  const head = buffer.subarray(0, Math.min(buffer.length, 512_000)).toString("latin1");
  if (!/%PDF-/i.test(head.slice(0, 16))) return false;
  // /Encrypt dictionary present and not clearly disabled
  if (!/\/Encrypt[\s\/\[]/.test(head)) return false;
  // Some producers leave Encrypt refs in dead objects; also check trailer hint
  if (/\/Encrypt\s+null/i.test(head)) return false;
  return true;
}

export const DOCUMENT_ENCRYPTED_CODE = "DOCUMENT_ENCRYPTED" as const;

export const DOCUMENT_ENCRYPTED_MESSAGE =
  "This PDF is encrypted or password-protected. Upload an unlocked copy to continue.";
