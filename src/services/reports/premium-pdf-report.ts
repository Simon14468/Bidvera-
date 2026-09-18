/**
 * Enterprise Bidvera PDF report — presentation layer only.
 * Consumes validated CanonicalReportSections + ReportDisplayContent;
 * never recalculates analysis, scores, or requirement counts.
 */

import PDFDocument from "pdfkit";
import type { Locale } from "@/i18n/config";
import { defaultLocale } from "@/i18n/config";
import type { CanonicalReportSections } from "@/services/reports/report-canonical-view";
import { formatDeadlineDisplay, NOT_AVAILABLE } from "@/services/reports/report-canonical-view";
import { parseCanonicalDeadlineIso } from "@/domain/tender-requirements/tender-deadline";
import {
  detectScriptsInText,
  registerPdfFonts,
  type PdfFontRegistry,
} from "@/services/reports/premium-pdf-fonts";
import {
  resolveLightLogoBuffer,
  resolveWhiteLogoBuffer,
} from "@/services/reports/premium-pdf-logo";
import { resolvePdfBranding, type PdfBranding } from "@/services/reports/premium-pdf-branding";
import { resolvePdfLocale } from "@/services/reports/premium-pdf-locale";
import {
  getPdfReportLabels,
  type PdfReportLabels,
} from "@/services/reports/premium-pdf-labels";
import {
  pdfTextAt,
  pdfTextBlock,
  pdfTextBlockPaginated,
  pdfWidthOfString,
} from "@/services/reports/premium-pdf-text";
import {
  addContentPage,
  ensureSectionHeadingSpace,
  ensureSpaceForBlock,
  ensureSubSectionHeadingSpace,
  tableFitsWithHeader,
} from "@/services/reports/premium-pdf-pagination";
import { validatePremiumPdfBuffer } from "@/services/reports/premium-pdf-validate";
import { COMPANY_EVIDENCE_LABEL } from "@/domain/provenance/messages";
import type { ReportDisplayContent } from "@/services/reports/report-display-content";
import { buildReportDisplayContent } from "@/services/reports/report-display-content";
import {
  PDF_BRAND,
  PDF_LAYOUT,
  colorForTone,
  softFillForTone,
  toneForDecision,
  toneForReadinessStatus,
  type PdfStatusTone,
} from "@/services/reports/premium-pdf-theme";

type PdfDoc = InstanceType<typeof PDFDocument>;

export type PremiumPdfOptions = {
  locale?: Locale;
  companyName?: string | null;
  appOrigin?: string | null;
  content?: ReportDisplayContent;
  /** Full pdf-parse density check. Tests only — never the live download path. */
  validate?: boolean;
};

type Ctx = {
  doc: PdfDoc;
  registry: PdfFontRegistry;
  locale: Locale;
  labels: PdfReportLabels;
  companyName: string;
  sections: CanonicalReportSections;
  content: ReportDisplayContent;
  contentBottom: number;
  branding: PdfBranding;
  lightLogo: Buffer | null;
  pageCount: number;
};

function textAlign(locale: Locale): "left" | "right" {
  return locale === "ar" ? "right" : "left";
}

function formatDate(iso: string | null, locale: Locale): string {
  if (!iso) return NOT_AVAILABLE;
  try {
    const parsed = parseCanonicalDeadlineIso(iso);
    const dateOnly =
      !parsed ||
      parsed.dateOnly ||
      parsed.hour == null ||
      /T00:00:00(\.000)?Z$/i.test(iso);
    const dateLabel = new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
      new Date(`${parsed?.dateYmd ?? iso.slice(0, 10)}T12:00:00.000Z`),
    );
    if (dateOnly || parsed?.hour == null || parsed.minute == null) return dateLabel;
    return `${dateLabel}, ${String(parsed.hour).padStart(2, "0")}:${String(parsed.minute).padStart(2, "0")}`;
  } catch {
    return iso;
  }
}

function truncate(s: string, n: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= n ? t : `${t.slice(0, n - 1)}…`;
}

function scoreTone(display: string): PdfStatusTone {
  if (display === NOT_AVAILABLE) return "neutral";
  const n = Number.parseInt(display.replace(/[^\d]/g, ""), 10);
  if (Number.isNaN(n)) return "neutral";
  if (n >= 70) return "green";
  if (n >= 45) return "yellow";
  return "red";
}

function collectPremiumPdfSourceText(input: {
  sections: CanonicalReportSections;
  content: ReportDisplayContent;
  labels: PdfReportLabels;
  companyName: string;
}): string {
  return [
    input.companyName,
    input.sections.title,
    input.sections.client ?? "",
    input.sections.reasoning,
    JSON.stringify(input.labels),
    JSON.stringify(input.content),
  ].join("\n");
}

export async function renderPremiumReportPdf(
  sections: CanonicalReportSections,
  options: PremiumPdfOptions = {},
): Promise<Buffer> {
  const locale = resolvePdfLocale(options.locale ?? defaultLocale);
  const content = options.content ?? buildReportDisplayContent(sections, locale);
  const labels = getPdfReportLabels(locale);
  const companyName = options.companyName?.trim() || NOT_AVAILABLE;
  const branding = resolvePdfBranding(options.appOrigin);
  const [whiteLogo, lightLogo] = await Promise.all([
    resolveWhiteLogoBuffer(),
    resolveLightLogoBuffer(),
  ]);
  const scripts = detectScriptsInText(
    collectPremiumPdfSourceText({ sections, content, labels, companyName }),
  );

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 0,
      bufferPages: true,
      info: {
        Title: `${labels.documentTitle} — ${sections.title}`,
        Author: PDF_BRAND.productName,
        Subject: "Tender decision report",
        Creator: PDF_BRAND.productName,
      },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c as Buffer));
    doc.on("end", () => {
      const buffer = Buffer.concat(chunks);
      if (options.validate !== true) {
        resolve(buffer);
        return;
      }
      validatePremiumPdfBuffer(buffer, { headerPhrases: [sections.title] })
        .then(() => resolve(buffer))
        .catch(reject);
    });
    doc.on("error", reject);

    const registry = registerPdfFonts(doc, scripts);
    const ctx: Ctx = {
      doc,
      registry,
      locale,
      labels,
      companyName,
      sections,
      content,
      contentBottom: PDF_LAYOUT.contentBottom,
      branding,
      lightLogo,
      pageCount: 1,
    };

    drawCover(ctx, whiteLogo);
    doc.addPage();
    ctx.pageCount = 2;
    startContentPage(ctx);

    drawExecutiveSummary(ctx);
    drawDecisionSection(ctx);
    drawExplainableDecisionSection(ctx);
    drawActionPlanSection(ctx);
    if (sections.bidScore && content.bidScoreDisplay) drawBidScore(ctx);
    if (sections.fitBreakdown?.dimensions?.length) drawFit(ctx);
    if (sections.readiness && sections.readinessCounts) drawReadiness(ctx);
    drawRequirementsSection(ctx);
    if (sections.complianceSummary) drawCompliance(ctx);
    if (content.verificationChains.length > 0) drawVerificationSection(ctx);
    drawListSection(ctx, labels.evidence, content.evidenceLines);
    drawListSection(ctx, labels.risks, content.riskLines);
    drawListSection(ctx, labels.missingDocuments, content.missingDocumentLines);
    if (content.actionPlanLines.length === 0) {
      drawListSection(ctx, labels.nextActions, content.nextActionLines);
    }
    drawListSection(ctx, labels.clarifications, content.clarificationLines);
    drawListSection(ctx, labels.sources, content.sourceLines);
    drawHistorical(ctx);

    ensureSpaceForBlock(ctx, 40);
    pdfTextBlockPaginated(ctx, labels.disclaimer, PDF_LAYOUT.marginX, doc.y, {
      width: PDF_LAYOUT.contentWidth,
      fontSize: 7.5,
      fillColor: PDF_BRAND.muted,
      align: textAlign(locale),
      locale,
    });

    stampContentPageChrome(ctx);
    doc.end();
  });
}

/* ─── Cover ─────────────────────────────────────────────────────────────── */

function drawCover(ctx: Ctx, whiteLogo: Buffer | null) {
  const { doc, registry, labels, sections, companyName, locale, branding } = ctx;
  const { marginX, contentWidth, pageWidth, pageHeight, coverHeroHeight } = PDF_LAYOUT;

  // Soft page ground — keeps cover integrated with content pages
  doc.rect(0, 0, pageWidth, pageHeight).fill(PDF_BRAND.soft);

  // Branded hero field
  doc.rect(0, 0, pageWidth, coverHeroHeight).fill(PDF_BRAND.ink);
  doc.rect(0, 0, 7, coverHeroHeight).fill(PDF_BRAND.primary);
  doc.rect(0, coverHeroHeight - 10, pageWidth, 10).fill(PDF_BRAND.primary);

  // Soft brand orbs (decorative depth — clipped to hero)
  doc.save();
  doc.rect(0, 0, pageWidth, coverHeroHeight).clip();
  doc.fillColor(PDF_BRAND.primary).fillOpacity(0.12);
  doc.circle(pageWidth - 36, 28, 118).fill();
  doc.fillColor(PDF_BRAND.white).fillOpacity(0.04);
  doc.circle(pageWidth + 30, coverHeroHeight - 10, 100).fill();
  doc.fillColor(PDF_BRAND.primary).fillOpacity(0.08);
  doc.circle(marginX + 40, coverHeroHeight + 20, 70).fill();
  doc.restore();
  doc.fillOpacity(1);

  // Logo lockup
  const logoY = 42;
  let logoDrawn = false;
  if (whiteLogo) {
    try {
      doc.image(whiteLogo, marginX, logoY, { height: 34 });
      logoDrawn = true;
    } catch {
      logoDrawn = false;
    }
  }
  if (!logoDrawn) {
    drawWordmark(doc, registry, marginX, logoY + 4, PDF_BRAND.white, locale);
  }

  // Report by — once, cover top only, clickable URI to resolved origin
  const reportByLabel = branding.reportBy;
  const reportBySize = 8.5;
  const reportByW = pdfWidthOfString(
    doc,
    registry,
    reportByLabel,
    reportBySize,
    false,
    locale,
  );
  const reportByX = Math.max(
    marginX,
    pageWidth - marginX - Math.min(reportByW, contentWidth * 0.58),
  );
  const reportByY = 48;
  const linkW = Math.min(reportByW, contentWidth * 0.58);
  pdfTextAt(doc, registry, reportByLabel, reportByX, reportByY, {
    fontSize: reportBySize,
    fillColor: PDF_BRAND.primary,
    lineBreak: false,
    locale,
  });
  // Manual underline (PDFKit underline + absolute coords can NaN)
  doc
    .moveTo(reportByX, reportByY + 12)
    .lineTo(reportByX + linkW, reportByY + 12)
    .lineWidth(0.7)
    .strokeColor(PDF_BRAND.primary)
    .stroke();
  // Explicit URI annotation — opens the resolved app origin in the browser
  if (
    Number.isFinite(reportByX) &&
    Number.isFinite(reportByY) &&
    Number.isFinite(linkW) &&
    linkW > 0
  ) {
    doc.link(reportByX - 2, reportByY - 2, linkW + 4, 16, branding.displayUrl);
  }

  pdfTextBlock(doc, registry, PDF_BRAND.tagline, marginX, 92, {
    width: contentWidth * 0.72,
    fontSize: 10,
    fillColor: PDF_BRAND.primaryMuted,
    locale,
  });

  pdfTextAt(doc, registry, labels.decisionReport.toUpperCase(), marginX, 122, {
    fontSize: 9.5,
    fillColor: "#9CA3AF",
    bold: true,
    locale,
  });

  // Title — capped length so the hero never overflows
  const title = truncate(sections.title, 140);
  pdfTextBlock(doc, registry, title, marginX, 142, {
    width: contentWidth,
    fontSize: 22,
    fillColor: PDF_BRAND.white,
    bold: true,
    lineGap: 4,
    align: textAlign(locale),
    locale,
  });

  // Decision badge inside hero for immediate executive scan
  const badgeY = coverHeroHeight - 52;
  drawDecisionBadge(
    ctx,
    marginX,
    badgeY,
    `${labels.recommendation}: ${ctx.content.decisionLabel}`,
    toneForDecision(sections.decision),
    contentWidth * 0.72,
  );

  // Meta card on soft ground
  const y = coverHeroHeight + 28;
  const cardPad = 18;
  const metaRows: Array<[string, string]> = [
    [labels.preparedFor, companyName],
    [labels.client, sections.client ?? labels.notAvailable],
    [
      labels.deadline,
      formatDeadlineDisplay(
        sections.deadlineIso,
        sections.deadlineTimezone,
        sections.deadlineStatus ?? null,
        sections.deadlineIso
          ? `${formatDate(sections.deadlineIso, locale)}${
              sections.deadlineTimezone && sections.deadlineIso.includes("T")
                ? ` (${sections.deadlineTimezone})`
                : ""
            }`
          : "",
      ),
    ],
    [labels.analyzed, formatDate(sections.analyzedAt, locale)],
    [labels.reportDate, formatDate(new Date().toISOString(), locale)],
  ];
  const rowH = 26;
  const cardH = cardPad * 2 + metaRows.length * rowH;
  const cardW = contentWidth;

  doc.roundedRect(marginX, y, cardW, cardH, PDF_LAYOUT.cardRadius).fill(PDF_BRAND.white);
  doc
    .roundedRect(marginX, y, cardW, cardH, PDF_LAYOUT.cardRadius)
    .lineWidth(0.75)
    .strokeColor(PDF_BRAND.border)
    .stroke();
  doc.rect(marginX, y, 4, cardH).fill(PDF_BRAND.primary);

  const colLabelW = 120;
  let rowY = y + cardPad;
  for (const [key, val] of metaRows) {
    pdfTextAt(doc, registry, key.toUpperCase(), marginX + 16, rowY, {
      width: colLabelW,
      fontSize: 7.5,
      fillColor: PDF_BRAND.muted,
      bold: true,
      locale,
    });
    pdfTextAt(doc, registry, truncate(val, 72), marginX + 16 + colLabelW, rowY - 1, {
      width: cardW - colLabelW - 32,
      fontSize: 10.5,
      fillColor: PDF_BRAND.ink,
      bold: true,
      align: textAlign(locale),
      locale,
    });
    rowY += rowH;
  }

  pdfTextBlock(doc, registry, labels.confidential, marginX, pageHeight - 48, {
    width: contentWidth,
    fontSize: 8,
    fillColor: PDF_BRAND.muted,
    align: "center",
    locale,
  });
}

function drawWordmark(
  doc: PdfDoc,
  registry: PdfFontRegistry,
  x: number,
  y: number,
  color: string,
  locale: Locale,
) {
  pdfTextAt(doc, registry, PDF_BRAND.productName, x, y, {
    fontSize: 20,
    fillColor: color,
    bold: true,
    locale,
  });
}

/* ─── Content pages ─────────────────────────────────────────────────────── */

function startContentPage(ctx: Ctx) {
  ctx.doc.y = PDF_LAYOUT.marginTop;
}

function stampContentPageChrome(ctx: Ctx) {
  const { doc, registry, labels, sections, locale, lightLogo } = ctx;
  const range = doc.bufferedPageRange();
  const total = range.count;

  for (let i = range.start; i < range.start + total; i++) {
    doc.switchToPage(i);
    const pageNo = i - range.start + 1;
    if (pageNo === 1) continue;

    doc.save();
    doc.rect(0, 0, PDF_LAYOUT.pageWidth, PDF_LAYOUT.headerHeight).fill(PDF_BRAND.white);
    doc
      .moveTo(PDF_LAYOUT.marginX, PDF_LAYOUT.headerHeight)
      .lineTo(PDF_LAYOUT.pageWidth - PDF_LAYOUT.marginX, PDF_LAYOUT.headerHeight)
      .lineWidth(0.75)
      .strokeColor(PDF_BRAND.border)
      .stroke();

    if (lightLogo) {
      try {
        doc.image(lightLogo, PDF_LAYOUT.marginX, 18, { height: 22 });
      } catch {
        /* ignore */
      }
    }

    pdfTextAt(
      doc,
      registry,
      truncate(sections.title, 72),
      PDF_LAYOUT.marginX + 100,
      24,
      {
        width: PDF_LAYOUT.contentWidth - 100,
        fontSize: 8,
        fillColor: PDF_BRAND.muted,
        align: textAlign(locale),
        locale,
      },
    );

    doc
      .moveTo(PDF_LAYOUT.marginX, PDF_LAYOUT.footerY - 14)
      .lineTo(PDF_LAYOUT.pageWidth - PDF_LAYOUT.marginX, PDF_LAYOUT.footerY - 14)
      .lineWidth(0.5)
      .strokeColor(PDF_BRAND.borderLight)
      .stroke();

    pdfTextAt(doc, registry, labels.confidential, PDF_LAYOUT.marginX, PDF_LAYOUT.footerY - 2, {
      fontSize: 7,
      fillColor: PDF_BRAND.muted,
      lineBreak: false,
      locale,
    });

    const pageLabel = labels.pageOf
      .replace("{page}", String(pageNo))
      .replace("{total}", String(total));
    const pageLabelW = pdfWidthOfString(doc, registry, pageLabel, 7.5, false, locale);
    pdfTextAt(
      doc,
      registry,
      pageLabel,
      PDF_LAYOUT.pageWidth - PDF_LAYOUT.marginX - pageLabelW,
      PDF_LAYOUT.footerY - 2,
      {
        fontSize: 7.5,
        fillColor: PDF_BRAND.muted,
        lineBreak: false,
        locale,
      },
    );

    doc.restore();
  }
}

/* ─── Sections ──────────────────────────────────────────────────────────── */

function drawExecutiveSummary(ctx: Ctx) {
  const { doc, labels, sections, content } = ctx;
  sectionTitle(ctx, labels.executiveSummary);

  const cards: Array<{ label: string; value: string; tone: PdfStatusTone }> = [
    {
      label: labels.recommendation,
      value: content.decisionLabel,
      tone: toneForDecision(sections.decision),
    },
    {
      label: labels.companyTenderFit,
      value: content.fitScoreDisplay,
      tone: scoreTone(content.fitScoreDisplay),
    },
    { label: labels.confidence, value: content.confidenceDisplay, tone: "neutral" },
  ];

  if (content.readinessScoreDisplay) {
    cards.push({
      label: labels.tenderReadiness,
      value: content.readinessScoreDisplay,
      tone: scoreTone(content.readinessScoreDisplay),
    });
  }
  if (content.bidScoreDisplay) {
    cards.push({
      label: labels.bidScore,
      value: content.bidScoreDisplay,
      tone: "neutral",
    });
  }

  drawKpiGrid(ctx, cards);

  if (content.executiveComplianceLine) {
    drawCallout(ctx, content.executiveComplianceLine, "neutral");
    doc.moveDown(0.6);
  }
}

function drawDecisionSection(ctx: Ctx) {
  const { doc, labels, sections, content } = ctx;
  sectionTitle(ctx, labels.decision, 48);
  drawDecisionBadge(
    ctx,
    PDF_LAYOUT.marginX,
    doc.y,
    content.decisionLabel,
    toneForDecision(sections.decision),
    PDF_LAYOUT.contentWidth * 0.55,
  );
  doc.y += 36;
  bodyText(ctx, content.reasoning);
  doc.moveDown(0.5);
}

function drawExplainableDecisionSection(ctx: Ctx) {
  const { content } = ctx;
  if (!content.explainableWhyHeadline && content.explainableTopReasonLines.length === 0) {
    return;
  }

  subheading(ctx, "Decision explanation", PDF_BRAND.primary);
  if (content.explainableWhyHeadline) {
    bodyText(ctx, content.explainableWhyHeadline);
    ctx.doc.moveDown(0.25);
  }
  if (content.explainableTopReasonLines.length) {
    mutedText(ctx, "Top reasons");
    for (const line of content.explainableTopReasonLines.slice(0, 6)) {
      bullet(ctx, line, "neutral");
    }
  }
  if (content.explainableBlockerLines.length) {
    mutedText(ctx, "Blockers");
    for (const line of content.explainableBlockerLines.slice(0, 6)) {
      bullet(ctx, line, "red");
    }
  }
  drawListSection(ctx, "Key requirements", content.explainableRequirementLines.slice(0, 8));
  drawListSection(ctx, "Evidence status", content.explainableEvidenceLines.slice(0, 8));
  drawListSection(ctx, "Risks (explanation)", content.explainableRiskLines.slice(0, 6));
  drawListSection(ctx, "Company fit (explanation)", content.explainableFitLines.slice(0, 4));
  drawListSection(ctx, "Readiness (explanation)", content.explainableReadinessLines.slice(0, 4));
  drawListSection(ctx, "Recommended actions", content.explainableActionLines.slice(0, 6));
  if (content.explainableMemoryLines.length) {
    drawListSection(ctx, "Historical context (not current evidence)", content.explainableMemoryLines.slice(0, 4));
  }
  ctx.doc.moveDown(0.4);
}

function drawActionPlanSection(ctx: Ctx) {
  const { content } = ctx;
  if (!content.actionPlanLines.length) return;

  subheading(ctx, "Action Plan — what to do next", PDF_BRAND.primary);
  if (content.actionPlanDeadlineLine) {
    mutedText(ctx, content.actionPlanDeadlineLine);
  }
  if (content.actionPlanUrgencyLine) {
    bodyText(ctx, content.actionPlanUrgencyLine);
  }
  for (const line of content.actionPlanLines.slice(0, 8)) {
    bullet(ctx, line, "neutral");
  }
  mutedText(
    ctx,
    "Completing actions does not change the decision directly — evidence must be verified and the Decision Engine re-run.",
  );
  ctx.doc.moveDown(0.35);
}

function drawBidScore(ctx: Ctx) {
  const { doc, registry, labels, sections, content, locale } = ctx;
  const bs = sections.bidScore!;
  sectionTitle(ctx, labels.bidScore, 72);

  ensureSpaceForBlock(ctx, 68);
  const y0 = doc.y;
  doc.roundedRect(PDF_LAYOUT.marginX, y0, PDF_LAYOUT.contentWidth, 68, PDF_LAYOUT.cardRadius)
    .fill(PDF_BRAND.soft);
  doc.rect(PDF_LAYOUT.marginX, y0, 4, 68).fill(PDF_BRAND.primary);

  pdfTextAt(doc, registry, content.bidScoreDisplay ?? NOT_AVAILABLE, PDF_LAYOUT.marginX + 16, y0 + 14, {
    fontSize: 22,
    fillColor: PDF_BRAND.ink,
    bold: true,
    locale,
  });
  pdfTextBlockPaginated(ctx, bs.interpretation, PDF_LAYOUT.marginX + 16, y0 + 42, {
    width: PDF_LAYOUT.contentWidth - 32,
    fontSize: 9,
    fillColor: PDF_BRAND.inkSoft,
    locale,
  });
  doc.y = y0 + 80;

  if (content.bidScoreMetaLine) {
    mutedText(ctx, content.bidScoreMetaLine);
    doc.moveDown(0.4);
  }

  if (content.bidScorePositiveDrivers.length) {
    subheading(ctx, labels.positive, PDF_BRAND.success);
    for (const d of content.bidScorePositiveDrivers) bullet(ctx, d, "green");
  }
  if (content.bidScoreNegativeDrivers.length) {
    subheading(ctx, labels.negative, PDF_BRAND.danger);
    for (const d of content.bidScoreNegativeDrivers) bullet(ctx, d, "red");
  }
  if (content.bidScoreDisclaimer) {
    mutedText(ctx, content.bidScoreDisclaimer);
  }
  doc.moveDown(0.6);
}

function drawFit(ctx: Ctx) {
  const { labels, content } = ctx;
  sectionTitle(ctx, labels.companyTenderFit);

  if (content.fitDimensionScores.length === 0) {
    bodyText(ctx, labels.notAvailable);
    return;
  }

  drawSimpleTable(
    ctx,
    [
      { key: "dim", label: labels.dimension, width: PDF_LAYOUT.contentWidth - 80 },
      { key: "score", label: labels.score, width: 80, align: "right" as const },
    ],
    content.fitDimensionScores.map((d) => ({
      dim: d.label,
      score: d.scoreDisplay,
    })),
  );

  if (content.fitOverallDisplay) {
    ensureSpaceForBlock(ctx, 20);
    pdfTextAt(
      ctx.doc,
      ctx.registry,
      `${labels.overall}: ${content.fitOverallDisplay}`,
      PDF_LAYOUT.marginX,
      ctx.doc.y,
      {
        fontSize: 11,
        fillColor: PDF_BRAND.ink,
        bold: true,
        locale: ctx.locale,
      },
    );
    ctx.doc.moveDown(0.35);
  }
  if (content.fitRequirementsNote) {
    ensureSpaceForBlock(ctx, 16);
    bodyText(ctx, content.fitRequirementsNote);
  }
  if (content.fitRecommendation) bodyText(ctx, content.fitRecommendation);
  ctx.doc.moveDown(0.5);
}

function drawReadiness(ctx: Ctx) {
  const { doc, labels, content } = ctx;
  sectionTitle(ctx, labels.tenderReadiness);

  const scoreLine = [
    content.readinessScoreDisplay ?? labels.notAvailable,
    content.readinessCountsLine,
  ]
    .filter(Boolean)
    .join(" · ");

  drawCallout(ctx, scoreLine, scoreTone(content.readinessScoreDisplay ?? ""));

  for (const a of content.readinessAttentionLines) bullet(ctx, a, "yellow");
  if (content.readinessNextStepLine) mutedText(ctx, content.readinessNextStepLine);
  doc.moveDown(0.5);
}

function drawRequirementsSection(ctx: Ctx) {
  const { missingRequirementLines, verifyRequirementLines } = ctx.content;
  if (missingRequirementLines.length === 0 && verifyRequirementLines.length === 0) {
    return;
  }

  sectionTitle(ctx, ctx.labels.requirements);
  if (missingRequirementLines.length > 0) {
    subSectionTitle(ctx, ctx.labels.missingRequirements, 22);
    for (const item of missingRequirementLines) bullet(ctx, item, "red");
    ctx.doc.moveDown(0.4);
  }
  if (verifyRequirementLines.length > 0) {
    subSectionTitle(ctx, ctx.labels.verificationItems, 22);
    for (const item of verifyRequirementLines) bullet(ctx, item, "yellow");
  }
  ctx.doc.moveDown(0.5);
}

function drawCompliance(ctx: Ctx) {
  const { labels, content } = ctx;
  sectionTitle(ctx, labels.complianceMatrix);

  if (content.complianceSummaryLine) {
    mutedText(ctx, content.complianceSummaryLine);
    ctx.doc.moveDown(0.3);
  }

  if (content.complianceRows.length === 0) {
    bodyText(ctx, labels.none);
    return;
  }

  for (const row of content.complianceRows) {
    drawComplianceRow(ctx, row);
  }
  ctx.doc.moveDown(0.3);
}


function drawComplianceRow(
  ctx: Ctx,
  row: ReportDisplayContent["complianceRows"][number],
) {
  const { doc, registry, locale } = ctx;
  const tone = toneForReadinessStatus(row.status);
  const pad = 12;
  const innerW = PDF_LAYOUT.contentWidth - pad * 2;
  const startPage = ctx.pageCount;

  ensureSpaceForBlock(ctx, 40);
  const y0 = doc.y;
  doc.rect(PDF_LAYOUT.marginX, y0, PDF_LAYOUT.contentWidth, 3).fill(colorForTone(tone));
  let cy = y0 + pad + 4;

  drawStatusChip(ctx, PDF_LAYOUT.marginX + pad, cy - 2, row.status, tone);

  pdfTextAt(doc, registry, row.mandatoryLabel, PDF_LAYOUT.marginX + pad + 72, cy, {
    width: innerW - 72,
    fontSize: 8,
    fillColor: PDF_BRAND.muted,
    align: textAlign(locale),
    locale,
  });
  cy += 16;

  cy =
    pdfTextBlockPaginated(ctx, row.requirement, PDF_LAYOUT.marginX + pad, cy, {
      width: innerW,
      fontSize: 10,
      fillColor: PDF_BRAND.ink,
      bold: true,
      lineGap: 2,
      locale,
    }) + 4;

  if (row.evidenceQuoted) {
    cy =
      pdfTextBlockPaginated(
        ctx,
        `“${row.evidenceQuoted}”`,
        PDF_LAYOUT.marginX + pad,
        cy,
        {
          width: innerW,
          fontSize: 8.5,
          fillColor: PDF_BRAND.inkSoft,
          lineGap: 2,
          locale,
        },
      ) + 3;
  }

  cy =
    pdfTextBlockPaginated(ctx, row.sourceLine, PDF_LAYOUT.marginX + pad, cy, {
      width: innerW,
      fontSize: 7.5,
      fillColor: PDF_BRAND.muted,
      locale,
    }) + 3;

  cy =
    pdfTextBlockPaginated(
      ctx,
      `${COMPANY_EVIDENCE_LABEL}: ${row.companyEvidenceLine}`,
      PDF_LAYOUT.marginX + pad,
      cy,
      {
        width: innerW,
        fontSize: 7.5,
        fillColor: PDF_BRAND.muted,
        locale,
      },
    ) + pad;

  const endY = doc.y;
  if (ctx.pageCount === startPage) {
    doc
      .roundedRect(
        PDF_LAYOUT.marginX,
        y0,
        PDF_LAYOUT.contentWidth,
        endY - y0,
        PDF_LAYOUT.cardRadius,
      )
      .lineWidth(0.75)
      .strokeColor(PDF_BRAND.border)
      .stroke();
  }

  doc.y = endY + 10;
}

function drawHistorical(ctx: Ctx) {
  const { labels, content } = ctx;
  sectionTitle(ctx, labels.historicalTitle);
  if (content.historicalLines.length > 0) {
    for (const line of content.historicalLines) bodyText(ctx, line);
  } else {
    bodyText(ctx, labels.historicalEmpty);
  }
}

function drawVerificationSection(ctx: Ctx) {
  const { labels, content } = ctx;
  sectionTitle(ctx, labels.evidenceVerificationTitle);
  if (content.verificationSummaryLine) {
    mutedText(ctx, content.verificationSummaryLine);
    ctx.doc.moveDown(0.3);
  }
  if (content.verificationDisclaimer) {
    mutedText(ctx, content.verificationDisclaimer);
    ctx.doc.moveDown(0.4);
  }
  for (const chain of content.verificationChains) {
    const tone =
      chain.status === "VERIFIED"
        ? "green"
        : chain.status === "MISSING_EVIDENCE"
          ? "red"
          : "yellow";
    bullet(ctx, `${chain.statusLabel}: ${chain.requirement}`, tone);
    if (chain.reason) mutedText(ctx, chain.reason);
    if (chain.locationLine) mutedText(ctx, chain.locationLine);
    if (chain.excerptLine) mutedText(ctx, `"${chain.excerptLine}"`);
    if (chain.verifierLine) mutedText(ctx, chain.verifierLine);
    ctx.doc.moveDown(0.25);
  }
  ctx.doc.moveDown(0.3);
}

function drawListSection(ctx: Ctx, title: string, items: string[]) {
  if (items.length === 0) return;
  sectionTitle(ctx, title, 22);
  for (const item of items) bullet(ctx, item, "neutral");
  ctx.doc.moveDown(0.3);
}

/* ─── Primitives ─────────────────────────────────────────────────────────── */

function drawKpiGrid(
  ctx: Ctx,
  cards: Array<{ label: string; value: string; tone: PdfStatusTone }>,
) {
  const { doc } = ctx;
  const gap = 10;
  const cols = 3;
  const cardW = (PDF_LAYOUT.contentWidth - gap * (cols - 1)) / cols;
  const cardH = 76;

  for (let row = 0; row < Math.ceil(cards.length / cols); row++) {
    ensureSpaceForBlock(ctx, cardH + 12);
    const startY = doc.y;
    const slice = cards.slice(row * cols, row * cols + cols);
    slice.forEach((card, i) => {
      const x = PDF_LAYOUT.marginX + i * (cardW + gap);
      drawKpiCard(ctx, x, startY, cardW, cardH, card);
    });
    doc.y = startY + cardH + gap;
  }
}

function drawKpiCard(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  card: { label: string; value: string; tone: PdfStatusTone },
) {
  const { doc, registry, locale } = ctx;
  const accent = card.tone === "neutral" ? PDF_BRAND.primary : colorForTone(card.tone);

  doc.roundedRect(x, y, w, h, PDF_LAYOUT.cardRadius).fill(PDF_BRAND.white);
  doc.roundedRect(x, y, w, h, PDF_LAYOUT.cardRadius).lineWidth(0.75).strokeColor(PDF_BRAND.border).stroke();
  doc.rect(x, y, w, 3).fill(accent);

  pdfTextAt(doc, registry, card.label.toUpperCase(), x + 12, y + 14, {
    width: w - 24,
    fontSize: 7.5,
    fillColor: PDF_BRAND.muted,
    bold: true,
    locale,
  });
  pdfTextBlock(doc, registry, truncate(card.value, 48), x + 12, y + 32, {
    width: w - 24,
    fontSize: 15,
    fillColor: PDF_BRAND.ink,
    bold: true,
    lineGap: 2,
    align: textAlign(locale),
    locale,
  });
}

function drawTableHeader(
  ctx: Ctx,
  columns: Array<{ key: string; label: string; width: number; align?: "left" | "right" }>,
  headerH: number,
) {
  const { doc, registry, locale } = ctx;
  const y = doc.y;
  doc.rect(PDF_LAYOUT.marginX, y, PDF_LAYOUT.contentWidth, headerH).fill(PDF_BRAND.primaryMuted);
  let x = PDF_LAYOUT.marginX;
  for (const col of columns) {
    pdfTextAt(doc, registry, col.label.toUpperCase(), x + 8, y + 7, {
      width: col.width - 16,
      fontSize: 8,
      fillColor: PDF_BRAND.inkSoft,
      bold: true,
      align: col.align ?? textAlign(locale),
      locale,
    });
    x += col.width;
  }
  doc.y = y + headerH;
}

function drawSimpleTable(
  ctx: Ctx,
  columns: Array<{ key: string; label: string; width: number; align?: "left" | "right" }>,
  rows: Array<Record<string, string>>,
) {
  const { doc, registry, locale } = ctx;
  const headerH = 24;
  const rowH = 22;
  let rowIndex = 0;

  while (rowIndex < rows.length) {
    if (!tableFitsWithHeader(ctx, headerH, rowH)) {
      addContentPage(ctx);
    }
    drawTableHeader(ctx, columns, headerH);

    while (rowIndex < rows.length) {
      if (doc.y + rowH > ctx.contentBottom) break;
      const y = doc.y;
      if (rowIndex % 2 === 1) {
        doc.rect(PDF_LAYOUT.marginX, y, PDF_LAYOUT.contentWidth, rowH).fill(PDF_BRAND.soft);
      }
      let cx = PDF_LAYOUT.marginX;
      const row = rows[rowIndex]!;
      for (const col of columns) {
        pdfTextAt(doc, registry, row[col.key] ?? "", cx + 8, y + 5, {
          width: col.width - 16,
          fontSize: 9.5,
          fillColor: PDF_BRAND.ink,
          bold: col.key === "score",
          align: col.align ?? textAlign(locale),
          locale,
        });
        cx += col.width;
      }
      doc.y = y + rowH;
      rowIndex += 1;
    }
  }

  doc
    .moveTo(PDF_LAYOUT.marginX, doc.y)
    .lineTo(PDF_LAYOUT.marginX + PDF_LAYOUT.contentWidth, doc.y)
    .lineWidth(0.75)
    .strokeColor(PDF_BRAND.border)
    .stroke();
  doc.moveDown(0.5);
}

function drawDecisionBadge(
  ctx: Ctx,
  x: number,
  y: number,
  label: string,
  tone: PdfStatusTone,
  maxW: number,
) {
  const { doc, registry, locale } = ctx;
  const color = colorForTone(tone === "neutral" ? "green" : tone);
  const bg = softFillForTone(tone === "neutral" ? "green" : tone);
  const fontSize = 10;
  const tw = Math.min(pdfWidthOfString(doc, registry, label, fontSize, true, locale) + 36, maxW);
  const h = 28;

  doc.roundedRect(x, y, tw, h, PDF_LAYOUT.pillRadius).fill(bg);
  doc.circle(x + 14, y + h / 2, 5).fill(color);
  pdfTextAt(doc, registry, label, x + 26, y + 8, {
    width: tw - 34,
    fontSize,
    fillColor: PDF_BRAND.ink,
    bold: true,
    lineBreak: false,
    locale,
  });
}

function drawStatusChip(
  ctx: Ctx,
  x: number,
  y: number,
  status: string,
  tone: PdfStatusTone,
) {
  const { doc, registry, locale } = ctx;
  const color = colorForTone(tone);
  const w = pdfWidthOfString(doc, registry, status, 8, true, locale) + 16;
  doc.roundedRect(x, y, w, 16, 8).fill(softFillForTone(tone));
  pdfTextAt(doc, registry, status, x + 8, y + 3, {
    width: w - 12,
    fontSize: 8,
    fillColor: color,
    bold: true,
    lineBreak: false,
    locale,
  });
}

function drawCallout(ctx: Ctx, text: string, tone: PdfStatusTone) {
  const { doc, locale } = ctx;
  const textX = PDF_LAYOUT.marginX + 14;
  const textW = PDF_LAYOUT.contentWidth - 28;
  const startPage = ctx.pageCount;
  ensureSpaceForBlock(ctx, 24);
  const y0 = doc.y;
  const endY = pdfTextBlockPaginated(ctx, text, textX, y0, {
    width: textW,
    fontSize: 10,
    fillColor: PDF_BRAND.ink,
    align: textAlign(locale),
    locale,
  });
  if (ctx.pageCount === startPage) {
    const barH = Math.max(endY - y0, 18);
    doc
      .rect(PDF_LAYOUT.marginX, y0, 4, barH)
      .fill(colorForTone(tone === "neutral" ? "green" : tone));
  }
  doc.y = endY + 8;
}

function sectionTitle(ctx: Ctx, title: string, minFollowing: number = 28) {
  ensureSectionHeadingSpace(ctx, minFollowing);
  const { doc, registry, locale } = ctx;
  doc.moveDown(0.2);
  const y = doc.y;
  doc.rect(PDF_LAYOUT.marginX, y, 4, 18).fill(PDF_BRAND.primary);
  pdfTextBlock(doc, registry, title, PDF_LAYOUT.marginX + 12, y, {
    width: PDF_LAYOUT.contentWidth - 12,
    fontSize: 14,
    fillColor: PDF_BRAND.ink,
    bold: true,
    align: textAlign(locale),
    locale,
  });
  doc.moveDown(0.9);
}

function subSectionTitle(ctx: Ctx, title: string, minFollowing: number = 18) {
  ensureSubSectionHeadingSpace(ctx, minFollowing);
  pdfTextAt(ctx.doc, ctx.registry, title, PDF_LAYOUT.marginX, ctx.doc.y, {
    width: PDF_LAYOUT.contentWidth,
    fontSize: 11,
    fillColor: PDF_BRAND.inkSoft,
    bold: true,
    locale: ctx.locale,
  });
  ctx.doc.moveDown(0.35);
}

function subheading(ctx: Ctx, text: string, color: string) {
  ensureSpaceForBlock(ctx, 16, { keepWithPrevious: 8 });
  pdfTextAt(ctx.doc, ctx.registry, text, PDF_LAYOUT.marginX, ctx.doc.y, {
    fontSize: 9,
    fillColor: color,
    bold: true,
    locale: ctx.locale,
  });
  ctx.doc.moveDown(0.25);
}

function bodyText(ctx: Ctx, text: string) {
  pdfTextBlockPaginated(ctx, text, PDF_LAYOUT.marginX, ctx.doc.y, {
    width: PDF_LAYOUT.contentWidth,
    fontSize: 10,
    fillColor: PDF_BRAND.ink,
    align: textAlign(ctx.locale),
    lineGap: 3,
    locale: ctx.locale,
  });
  ctx.doc.moveDown(0.3);
}

function mutedText(ctx: Ctx, text: string) {
  pdfTextBlockPaginated(ctx, text, PDF_LAYOUT.marginX, ctx.doc.y, {
    width: PDF_LAYOUT.contentWidth,
    fontSize: 9,
    fillColor: PDF_BRAND.muted,
    align: textAlign(ctx.locale),
    lineGap: 2,
    locale: ctx.locale,
  });
  ctx.doc.moveDown(0.25);
}

function bullet(ctx: Ctx, text: string, tone: PdfStatusTone) {
  ensureSpaceForBlock(ctx, 16);
  const y = ctx.doc.y;
  const { doc, locale } = ctx;
  doc.circle(PDF_LAYOUT.marginX + 6, y + 5, 3).fill(colorForTone(tone));
  pdfTextBlockPaginated(ctx, text, PDF_LAYOUT.marginX + 16, y, {
    width: PDF_LAYOUT.contentWidth - 16,
    fontSize: 9.5,
    fillColor: PDF_BRAND.ink,
    align: textAlign(locale),
    lineGap: 2,
    locale,
  });
  doc.moveDown(0.2);
}

