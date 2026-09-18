import fs from "node:fs";
import path from "node:path";
import type PDFDocument from "pdfkit";

type PdfDoc = InstanceType<typeof PDFDocument>;

const FONT_DIR = path.join(process.cwd(), "assets", "fonts");

export type ScriptKind = "latin" | "arabic" | "cjk";

/** All embedded fonts — used on every page for mixed tender content. */
export type PdfFontRegistry = {
  latin: { regular: string; bold: string };
  arabic: { regular: string; bold: string };
  cjk: { regular: string; bold: string };
  fontFor(script: ScriptKind, bold?: boolean): string;
};

const ARABIC_RE =
  /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u0660-\u0669]/;
const ARABIC_MARKS_RE =
  /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u0660-\u0669\u060C\u061B\u061F\u0640\uFD3E\uFD3F]/;
const CJK_RE = /[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]/;
const LATIN_RE =
  /[A-Za-z\u00C0-\u024F\u1E00-\u1EFF]/;

function exists(file: string): boolean {
  try {
    return fs.existsSync(file);
  } catch {
    return false;
  }
}

function registerFont(
  doc: PdfDoc,
  name: string,
  filePath: string,
  fallback: string,
): string {
  if (exists(filePath)) {
    doc.registerFont(name, filePath);
    return name;
  }
  return fallback;
}

export function detectScriptsInText(text: string): Set<ScriptKind> {
  const scripts = new Set<ScriptKind>(["latin"]);
  if (ARABIC_RE.test(text)) scripts.add("arabic");
  if (CJK_RE.test(text)) scripts.add("cjk");
  return scripts;
}

/**
 * Register Noto fonts for the scripts actually present in the report.
 * Latin is always loaded. Arabic / CJK files are parsed only when needed —
 * the CJK face is ~16MB and must not be opened on every Latin/Arabic download.
 */
export function registerPdfFonts(
  doc: PdfDoc,
  scripts?: Iterable<ScriptKind>,
): PdfFontRegistry {
  const needed = new Set<ScriptKind>(scripts ?? ["latin", "arabic", "cjk"]);
  needed.add("latin");

  const latinRegular = registerFont(
    doc,
    "Bidvera-Latin",
    path.join(FONT_DIR, "NotoSans-Regular.ttf"),
    "Helvetica",
  );
  const latinBold = registerFont(
    doc,
    "Bidvera-Latin-Bold",
    path.join(FONT_DIR, "NotoSans-SemiBold.ttf"),
    "Helvetica-Bold",
  );
  const arabicRegular = needed.has("arabic")
    ? registerFont(
        doc,
        "Bidvera-Arabic",
        path.join(FONT_DIR, "NotoSansArabic-Regular.ttf"),
        latinRegular,
      )
    : latinRegular;
  const arabicBold = needed.has("arabic")
    ? registerFont(
        doc,
        "Bidvera-Arabic-Bold",
        path.join(FONT_DIR, "NotoSansArabic-SemiBold.ttf"),
        latinBold,
      )
    : latinBold;
  const cjkRegular = needed.has("cjk")
    ? registerFont(
        doc,
        "Bidvera-CJK",
        path.join(FONT_DIR, "NotoSansSC-Regular.otf"),
        latinRegular,
      )
    : latinRegular;
  const cjkBold = needed.has("cjk")
    ? registerFont(
        doc,
        "Bidvera-CJK-Bold",
        path.join(FONT_DIR, "NotoSansSC-Regular.otf"),
        latinBold,
      )
    : latinBold;

  const latin = { regular: latinRegular, bold: latinBold };
  const arabic = { regular: arabicRegular, bold: arabicBold };
  const cjk = { regular: cjkRegular, bold: cjkBold };

  return {
    latin,
    arabic,
    cjk,
    fontFor(script: ScriptKind, bold = false) {
      const bucket =
        script === "arabic" ? arabic : script === "cjk" ? cjk : latin;
      return bold ? bucket.bold : bucket.regular;
    },
  };
}

/** Registers every face — tests and mixed-script probes only. */
export function registerAllPdfFonts(doc: PdfDoc): PdfFontRegistry {
  return registerPdfFonts(doc, ["latin", "arabic", "cjk"]);
}

export function scriptOfChar(char: string): ScriptKind {
  if (ARABIC_MARKS_RE.test(char)) return "arabic";
  if (CJK_RE.test(char)) return "cjk";
  if (LATIN_RE.test(char)) return "latin";
  // Digits, punctuation, symbols — Latin Noto covers FR/EN punctuation & digits reliably.
  return "latin";
}

export function splitIntoScriptRuns(
  text: string,
): Array<{ script: ScriptKind; text: string }> {
  if (!text) return [];
  const runs: Array<{ script: ScriptKind; text: string }> = [];
  let current = "";
  let currentScript: ScriptKind | null = null;

  for (const char of text) {
    const script = scriptOfChar(char);
    if (currentScript === null) {
      currentScript = script;
      current = char;
      continue;
    }
    if (script === currentScript) {
      current += char;
    } else {
      runs.push({ script: currentScript, text: current });
      currentScript = script;
      current = char;
    }
  }
  if (current && currentScript) {
    runs.push({ script: currentScript, text: current });
  }
  return runs;
}

export function textContainsArabic(text: string): boolean {
  return ARABIC_RE.test(text);
}

export function resolveLogoPath(): string | null {
  const candidates = [
    path.join(process.cwd(), "public", "bidvera-logo.png"),
    path.join(process.cwd(), "public", "Bidvera AI logo orgenall.png"),
    path.join(process.cwd(), "public", "Bidvera AI logo.png"),
  ];
  return candidates.find((p) => exists(p)) ?? null;
}
