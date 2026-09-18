/**
 * Landing media content sniff — never trust client MIME/extension.
 * Rejects SVG/HTML/script and executable payloads.
 */

import { isDangerousBinaryContent } from "@/domain/tender-package/upload-content-sniff";

export type LandingSniffedKind =
  | "jpeg"
  | "png"
  | "webp"
  | "gif"
  | "mp4"
  | "webm"
  | "quicktime"
  | "rejected"
  | "unknown";

export type LandingSniffResult = {
  kind: LandingSniffedKind;
  mimeType: string;
  ext: string;
};

function startsWithBytes(buf: Buffer, bytes: number[]): boolean {
  if (buf.length < bytes.length) return false;
  return bytes.every((b, i) => buf[i] === b);
}

function sampleAscii(body: Buffer, max = 4096): string {
  return body.subarray(0, Math.min(body.length, max)).toString("latin1");
}

/** Detect SVG/HTML/script disguised as images (text or XML leading). */
export function looksLikeSvgOrHtml(body: Buffer): boolean {
  const head = sampleAscii(body).replace(/^\uFEFF/, "").trimStart().toLowerCase();
  if (head.startsWith("<svg") || head.includes("<svg")) return true;
  if (head.startsWith("<!doctype html") || head.startsWith("<html")) return true;
  if (head.startsWith("<?xml") && head.includes("<svg")) return true;
  if (head.startsWith("<script")) return true;
  return false;
}

function sniffMp4OrQuicktime(body: Buffer): LandingSniffResult | null {
  // ISO BMFF: size(4) + 'ftyp'(4) at offset 0 or rarely after free atom
  if (body.length < 12) return null;
  const brandAt = (offset: number) =>
    body.length >= offset + 8 &&
    body[offset + 4] === 0x66 &&
    body[offset + 5] === 0x74 &&
    body[offset + 6] === 0x79 &&
    body[offset + 7] === 0x70;

  let ftypOffset = -1;
  if (brandAt(0)) ftypOffset = 0;
  else if (body.length >= 20 && brandAt(8)) ftypOffset = 8;

  if (ftypOffset < 0) return null;

  const brand = body
    .subarray(ftypOffset + 8, ftypOffset + 12)
    .toString("ascii")
    .toLowerCase();
  // QuickTime / MOV brands
  if (brand === "qt  " || brand.startsWith("qt")) {
    return { kind: "quicktime", mimeType: "video/quicktime", ext: ".mov" };
  }
  // Common MP4 brands
  if (
    brand.includes("mp4") ||
    brand === "isom" ||
    brand === "iso2" ||
    brand === "avc1" ||
    brand === "dash" ||
    brand === "msdh" ||
    brand === "m4v "
  ) {
    return { kind: "mp4", mimeType: "video/mp4", ext: ".mp4" };
  }
  // Default ftyp → treat as mp4 family (not SVG/HTML)
  return { kind: "mp4", mimeType: "video/mp4", ext: ".mp4" };
}

export function sniffLandingMedia(body: Buffer): LandingSniffResult {
  if (body.length < 12) {
    return { kind: "unknown", mimeType: "application/octet-stream", ext: "" };
  }

  if (isDangerousBinaryContent(body) || looksLikeSvgOrHtml(body)) {
    return { kind: "rejected", mimeType: "application/octet-stream", ext: "" };
  }

  // PNG
  if (startsWithBytes(body, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { kind: "png", mimeType: "image/png", ext: ".png" };
  }
  // JPEG
  if (startsWithBytes(body, [0xff, 0xd8, 0xff])) {
    return { kind: "jpeg", mimeType: "image/jpeg", ext: ".jpg" };
  }
  // GIF
  if (
    startsWithBytes(body, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) ||
    startsWithBytes(body, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
  ) {
    return { kind: "gif", mimeType: "image/gif", ext: ".gif" };
  }
  // WebP: RIFF....WEBP
  if (
    startsWithBytes(body, [0x52, 0x49, 0x46, 0x46]) &&
    body.length >= 12 &&
    body[8] === 0x57 &&
    body[9] === 0x45 &&
    body[10] === 0x42 &&
    body[11] === 0x50
  ) {
    return { kind: "webp", mimeType: "image/webp", ext: ".webp" };
  }
  // WebM / Matroska
  if (startsWithBytes(body, [0x1a, 0x45, 0xdf, 0xa3])) {
    return { kind: "webm", mimeType: "video/webm", ext: ".webm" };
  }

  const video = sniffMp4OrQuicktime(body);
  if (video) return video;

  return { kind: "unknown", mimeType: "application/octet-stream", ext: "" };
}

const IMAGE_KINDS = new Set<LandingSniffedKind>(["jpeg", "png", "webp", "gif"]);
const VIDEO_KINDS = new Set<LandingSniffedKind>(["mp4", "webm", "quicktime"]);

export function assertLandingUploadAllowed(
  kind: "video" | "poster" | "avatar",
  body: Buffer,
): LandingSniffResult {
  const sniffed = sniffLandingMedia(body);
  if (sniffed.kind === "rejected" || sniffed.kind === "unknown") {
    return sniffed;
  }
  if (kind === "video") {
    if (!VIDEO_KINDS.has(sniffed.kind)) {
      return { kind: "unknown", mimeType: sniffed.mimeType, ext: "" };
    }
    return sniffed;
  }
  if (!IMAGE_KINDS.has(sniffed.kind)) {
    return { kind: "unknown", mimeType: sniffed.mimeType, ext: "" };
  }
  return sniffed;
}
