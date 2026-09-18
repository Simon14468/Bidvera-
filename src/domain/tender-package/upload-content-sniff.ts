/**
 * Detect document/archive content from magic bytes — never trust client MIME/extension alone.
 * Plain-text formats (TXT/CSV) require content shape validation (+ optional filename hint).
 */

export type DetectedUploadKind =
  | "pdf"
  | "doc"
  | "docx"
  | "xls"
  | "xlsx"
  | "csv"
  | "ppt"
  | "pptx"
  | "txt"
  | "png"
  | "jpeg"
  | "tiff"
  | "zip"
  | "rar"
  | "unknown";

export type SniffedUpload = {
  kind: DetectedUploadKind;
  mimeType: string;
};

const MIME = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  png: "image/png",
  jpeg: "image/jpeg",
  tiff: "image/tiff",
  zip: "application/zip",
  rar: "application/vnd.rar",
} as const;

const DOCUMENT_KINDS = new Set<DetectedUploadKind>([
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "csv",
  "ppt",
  "pptx",
  "txt",
  "png",
  "jpeg",
  "tiff",
]);

function startsWithBytes(buf: Buffer, bytes: number[]): boolean {
  if (buf.length < bytes.length) return false;
  return bytes.every((b, i) => buf[i] === b);
}

/** Executables / scripts that must never enter a tender package. */
export function isDangerousBinaryContent(body: Buffer): boolean {
  if (body.length < 2) return false;
  // MZ (Windows PE), ELF, Mach-O
  if (startsWithBytes(body, [0x4d, 0x5a])) return true;
  if (startsWithBytes(body, [0x7f, 0x45, 0x4c, 0x46])) return true;
  if (startsWithBytes(body, [0xfe, 0xed, 0xfa, 0xce]) || startsWithBytes(body, [0xcf, 0xfa, 0xed, 0xfe])) {
    return true;
  }
  // Shebang scripts
  if (startsWithBytes(body, [0x23, 0x21])) return true;
  return false;
}

function sampleLatin1(body: Buffer, max = 65_536): string {
  return body.subarray(0, Math.min(body.length, max)).toString("latin1");
}

function sniffOleKind(body: Buffer): "doc" | "xls" | "ppt" {
  const sample = sampleLatin1(body);
  // UTF-16LE stream names appear as W\0o\0r\0d\0…
  if (/W\0o\0r\0d\0D\0o\0c\0u\0m\0e\0n\0t\0/i.test(sample) || /WordDocument/i.test(sample)) {
    return "doc";
  }
  if (
    /W\0o\0r\0k\0b\0o\0o\0k\0/i.test(sample) ||
    /Workbook/i.test(sample) ||
    /B\0o\0o\0k\0/i.test(sample)
  ) {
    return "xls";
  }
  if (
    /P\0o\0w\0e\0r\0P\0o\0i\0n\0t/i.test(sample) ||
    /PowerPoint/i.test(sample)
  ) {
    return "ppt";
  }
  // Legacy default — preserve prior DOC acceptance for ambiguous OLE
  return "doc";
}

function readUInt16LE(buf: Buffer, offset: number): number {
  if (offset + 2 > buf.length) return 0;
  return buf.readUInt16LE(offset);
}

function readUInt32LE(buf: Buffer, offset: number): number {
  if (offset + 4 > buf.length) return 0;
  return buf.readUInt32LE(offset);
}

/**
 * List ZIP entry paths from the central directory (sync, no inflate).
 * Used to distinguish OOXML packages from container ZIPs that embed XLSX/DOCX.
 */
export function listZipCentralDirectoryNames(body: Buffer, maxNames = 80): string[] {
  if (body.length < 22) return [];
  // EOCD signature: PK\x05\x06 — scan from end (max comment 64KiB + EOCD).
  const scanFrom = Math.max(0, body.length - 65_536 - 22);
  let eocd = -1;
  for (let i = body.length - 22; i >= scanFrom; i--) {
    if (
      body[i] === 0x50 &&
      body[i + 1] === 0x4b &&
      body[i + 2] === 0x05 &&
      body[i + 3] === 0x06
    ) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return [];

  const totalEntries = readUInt16LE(body, eocd + 10);
  const centralSize = readUInt32LE(body, eocd + 12);
  const centralOffset = readUInt32LE(body, eocd + 16);
  if (centralOffset + 4 > body.length) return [];
  if (centralSize > body.length) return [];

  const names: string[] = [];
  let offset = centralOffset;
  const limit = Math.min(totalEntries || maxNames, maxNames);
  for (let n = 0; n < limit; n++) {
    if (offset + 46 > body.length) break;
    if (
      body[offset] !== 0x50 ||
      body[offset + 1] !== 0x4b ||
      body[offset + 2] !== 0x01 ||
      body[offset + 3] !== 0x02
    ) {
      break;
    }
    const nameLen = readUInt16LE(body, offset + 28);
    const extraLen = readUInt16LE(body, offset + 30);
    const commentLen = readUInt16LE(body, offset + 32);
    const nameStart = offset + 46;
    const nameEnd = nameStart + nameLen;
    if (nameEnd > body.length) break;
    const name = body.subarray(nameStart, nameEnd).toString("utf8");
    if (name && !name.endsWith("/")) names.push(name.replace(/\\/g, "/"));
    offset = nameEnd + extraLen + commentLen;
  }
  return names;
}

/**
 * Classify ZIP-family buffers using entry *names* (not raw substring scan).
 * Container ZIPs that embed an .xlsx must NOT be classified as XLSX.
 */
function sniffZipPackageKind(body: Buffer): "docx" | "xlsx" | "pptx" | "zip" {
  const names = listZipCentralDirectoryNames(body);
  if (names.length === 0) {
    // Fallback for truncated/odd ZIPs — only trust OOXML when Content_Types is an entry-like path
    // at the start of the archive local headers (first ~2KB filenames), not deep nested bytes.
    const head = body.subarray(0, Math.min(body.length, 4096)).toString("latin1");
    const firstNameMatch = /PK\x03\x04[\s\S]{22}([^\x00]{1,180})/.exec(head);
    const firstName = (firstNameMatch?.[1] ?? "").replace(/\\/g, "/");
    if (/^\[Content_Types\]\.xml$/i.test(firstName.trim()) || /word\/document\.xml/i.test(head.slice(0, 800))) {
      if (/word\//i.test(head)) return "docx";
      if (/xl\//i.test(head) || /workbook\.xml/i.test(head)) return "xlsx";
      if (/ppt\//i.test(head)) return "pptx";
    }
    return "zip";
  }

  const hasContentTypes = names.some((n) => /(^|\/)\[Content_Types\]\.xml$/i.test(n));
  const hasWord = names.some((n) => /(^|\/)word\//i.test(n));
  const hasXl = names.some((n) => /(^|\/)xl\//i.test(n) || /(^|\/)workbook\.xml$/i.test(n));
  const hasPpt = names.some((n) => /(^|\/)ppt\//i.test(n));

  // True OOXML packages always declare Content_Types at package root.
  if (hasContentTypes && hasWord && !hasXl && !hasPpt) return "docx";
  if (hasContentTypes && hasXl && !hasWord && !hasPpt) return "xlsx";
  if (hasContentTypes && hasPpt && !hasWord && !hasXl) return "pptx";
  if (hasContentTypes && hasWord) return "docx";
  if (hasContentTypes && hasXl) return "xlsx";
  if (hasContentTypes && hasPpt) return "pptx";
  return "zip";
}

/** True when buffer is safe plain text (UTF-8/latin1 printable), not a binary spoof. */
export function isPlainTextContent(body: Buffer): boolean {
  if (body.length === 0) return false;
  if (isDangerousBinaryContent(body)) return false;
  const sample = body.subarray(0, Math.min(body.length, 8192));
  let weird = 0;
  for (let i = 0; i < sample.length; i++) {
    const c = sample[i]!;
    if (c === 0) return false;
    // Allow tab/lf/cr and printable; count other control bytes as weird
    if (c < 0x09 || (c > 0x0d && c < 0x20) || c === 0x7f) weird += 1;
  }
  return weird / sample.length < 0.02;
}

function textKindFromName(fileName?: string): "csv" | "txt" | null {
  if (!fileName) return null;
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".csv")) return "csv";
  if (lower.endsWith(".txt") || lower.endsWith(".text")) return "txt";
  return null;
}

/**
 * Sniff supported tender documents and archives from content.
 * Optional fileName is used only as a hint for plain-text CSV/TXT discrimination.
 */
export function sniffUploadContent(body: Buffer, fileName?: string): SniffedUpload {
  if (body.length < 4) {
    return { kind: "unknown", mimeType: "application/octet-stream" };
  }

  if (isDangerousBinaryContent(body)) {
    return { kind: "unknown", mimeType: "application/octet-stream" };
  }

  // %PDF at byte 0
  if (body[0] === 0x25 && body[1] === 0x50 && body[2] === 0x44 && body[3] === 0x46) {
    return { kind: "pdf", mimeType: MIME.pdf };
  }

  // PNG
  if (startsWithBytes(body, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { kind: "png", mimeType: MIME.png };
  }

  // JPEG
  if (startsWithBytes(body, [0xff, 0xd8, 0xff])) {
    return { kind: "jpeg", mimeType: MIME.jpeg };
  }

  // TIFF
  if (
    startsWithBytes(body, [0x49, 0x49, 0x2a, 0x00]) ||
    startsWithBytes(body, [0x4d, 0x4d, 0x00, 0x2a])
  ) {
    return { kind: "tiff", mimeType: MIME.tiff };
  }

  // RAR 1.5 / 5.0: Rar!\x1A\x07
  if (
    body[0] === 0x52 &&
    body[1] === 0x61 &&
    body[2] === 0x72 &&
    body[3] === 0x21 &&
    body[4] === 0x1a &&
    body[5] === 0x07
  ) {
    return { kind: "rar", mimeType: MIME.rar };
  }

  // OLE Compound File
  if (startsWithBytes(body, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
    const ole = sniffOleKind(body);
    if (ole === "xls") return { kind: "xls", mimeType: MIME.xls };
    if (ole === "ppt") return { kind: "ppt", mimeType: MIME.ppt };
    return { kind: "doc", mimeType: MIME.doc };
  }

  // ZIP family (DOCX / XLSX / PPTX / archive)
  if (
    startsWithBytes(body, [0x50, 0x4b, 0x03, 0x04]) ||
    startsWithBytes(body, [0x50, 0x4b, 0x05, 0x06]) ||
    startsWithBytes(body, [0x50, 0x4b, 0x07, 0x08])
  ) {
    const kind = sniffZipPackageKind(body);
    if (kind === "docx") return { kind: "docx", mimeType: MIME.docx };
    if (kind === "xlsx") return { kind: "xlsx", mimeType: MIME.xlsx };
    if (kind === "pptx") return { kind: "pptx", mimeType: MIME.pptx };
    return { kind: "zip", mimeType: MIME.zip };
  }

  // Plain text / CSV — content shape required; filename must end with .txt/.csv
  if (isPlainTextContent(body)) {
    const hint = textKindFromName(fileName);
    if (hint === "csv") return { kind: "csv", mimeType: MIME.csv };
    if (hint === "txt") return { kind: "txt", mimeType: MIME.txt };
  }

  // Recoverable PDF with leading junk — only when not a ZIP/OLE/archive container
  // and either named .pdf or %PDF- appears in the first 1KB after non-container bytes.
  if (
    body[0] !== 0x50 &&
    body[0] !== 0x52 && // RAR
    !(body[0] === 0xd0 && body[1] === 0xcf)
  ) {
    const pdfMarker = Buffer.from("%PDF-");
    const pdfScanLimit = Math.min(body.length, 1024);
    const pdfOffset = body.subarray(0, pdfScanLimit).indexOf(pdfMarker);
    if (pdfOffset > 0) {
      return { kind: "pdf", mimeType: MIME.pdf };
    }
  }

  return { kind: "unknown", mimeType: "application/octet-stream" };
}

/** True when sniffed content is an allowed tender document (not an archive). */
export function isAllowedUploadContent(
  body: Buffer,
  fileName?: string,
): SniffedUpload | null {
  const sniffed = sniffUploadContent(body, fileName);
  if (DOCUMENT_KINDS.has(sniffed.kind)) return sniffed;
  return null;
}

/** True when sniffed content is a supported tender-package archive. */
export function isArchiveUploadContent(body: Buffer, fileName?: string): SniffedUpload | null {
  const sniffed = sniffUploadContent(body, fileName);
  if (sniffed.kind === "zip" || sniffed.kind === "rar") return sniffed;

  // Defense: container ZIP mislabeled by nested OOXML bytes — honor .zip/.rar + magic.
  const lower = (fileName ?? "").toLowerCase();
  if (
    lower.endsWith(".zip") &&
    (startsWithBytes(body, [0x50, 0x4b, 0x03, 0x04]) ||
      startsWithBytes(body, [0x50, 0x4b, 0x05, 0x06]) ||
      startsWithBytes(body, [0x50, 0x4b, 0x07, 0x08]))
  ) {
    // Only force-archive when central directory says this is NOT a lone OOXML package.
    if (sniffZipPackageKind(body) === "zip") {
      return { kind: "zip", mimeType: MIME.zip };
    }
  }
  if (
    lower.endsWith(".rar") &&
    body[0] === 0x52 &&
    body[1] === 0x61 &&
    body[2] === 0x72 &&
    body[3] === 0x21
  ) {
    return { kind: "rar", mimeType: MIME.rar };
  }
  return null;
}

export function isDocumentUploadKind(kind: DetectedUploadKind): boolean {
  return DOCUMENT_KINDS.has(kind);
}
