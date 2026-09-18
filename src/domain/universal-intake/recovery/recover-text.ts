/**
 * Text encoding recovery — never invents characters beyond re-decoding existing bytes.
 */

import type { RecoveryAttempt } from "./types";
import { makeRecoveryAttempt, sha256Hex } from "./recover-pdf";

export type TextEncodingRecovery = {
  ok: boolean;
  repairedBytes: Buffer | null;
  attempts: RecoveryAttempt[];
  warnings: string[];
  message: string | null;
};

/**
 * Normalize UTF-8 BOM and replace lone UTF-16 LE BOM files with UTF-8 when
 * the payload is clearly ASCII/UTF-8 convertible — does not invent prose.
 */
export function recoverTextEncoding(bytes: Buffer): TextEncodingRecovery {
  const attempts: RecoveryAttempt[] = [];
  const warnings: string[] = [];

  // UTF-8 BOM
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    const stripped = bytes.subarray(3);
    attempts.push(
      makeRecoveryAttempt("NORMALIZE_TEXT_ENCODING", true, "Stripped UTF-8 BOM.", true),
    );
    warnings.push("UTF-8 BOM removed.");
    return {
      ok: true,
      repairedBytes: stripped,
      attempts,
      warnings,
      message: "Normalized text encoding (UTF-8 BOM stripped).",
    };
  }

  // UTF-16 LE BOM → decode to utf8 when mostly text
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    try {
      const decoded = bytes.subarray(2).toString("utf16le");
      // Reject if too many replacement-like null density suggests binary
      const nulls = [...decoded].filter((c) => c === "\u0000").length;
      if (nulls > decoded.length * 0.1) {
        attempts.push(
          makeRecoveryAttempt(
            "NORMALIZE_TEXT_ENCODING",
            false,
            "UTF-16 LE payload looks binary — left unchanged.",
            false,
          ),
        );
        return { ok: true, repairedBytes: null, attempts, warnings, message: null };
      }
      const out = Buffer.from(decoded, "utf8");
      attempts.push(
        makeRecoveryAttempt(
          "NORMALIZE_TEXT_ENCODING",
          true,
          `Re-encoded UTF-16 LE → UTF-8 (${sha256Hex(out).slice(0, 12)}…).`,
          true,
        ),
      );
      warnings.push("Text re-encoded from UTF-16 LE to UTF-8.");
      return {
        ok: true,
        repairedBytes: out,
        attempts,
        warnings,
        message: "Normalized text encoding (UTF-16 LE → UTF-8).",
      };
    } catch {
      attempts.push(
        makeRecoveryAttempt("NORMALIZE_TEXT_ENCODING", false, "UTF-16 decode failed.", false),
      );
    }
  }

  attempts.push(
    makeRecoveryAttempt("NORMALIZE_TEXT_ENCODING", true, "Encoding already usable.", false),
  );
  return { ok: true, repairedBytes: null, attempts, warnings, message: null };
}
