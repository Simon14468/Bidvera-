/**
 * Generates the synthetic regression tender PDF (fixtures only — not production logic).
 * Run: npx tsx scripts/generate-atlas-regression-tender.ts
 */
import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";

const OUT_DIR = path.join("tests", "fixtures", "regression");
const OUT_FILE = path.join(OUT_DIR, "Digital_Citizen_Services_Platform_Tender.pdf");

const BODY = `
INVITATION TO TENDER / REQUEST FOR PROPOSAL

Title: Digital Citizen Services Platform
Contracting Entity: National Public Services Authority
Country: Morocco
Estimated Contract Value: MAD 600,000
Duration: 8 months
Submission Deadline: 30 days from publication

SCOPE OF WORK
The Authority invites tenders for the design and delivery of a Digital Citizen Services Platform.

MANDATORY REQUIREMENTS
Tenderers shall provide evidence against each of the following mandatory requirements.

R1 — Web Application Development (Required)
The supplier must demonstrate experience developing web-based information systems and citizen-facing portals.

R2 — Mobile Application Development (Required)
The supplier must demonstrate mobile application development capability for citizen or field-service use.

R3 — Cloud Deployment (Required)
The supplier must provide cloud deployment architecture and managed application environment capability.

R4 — REST API / System Integration (Required)
The supplier must demonstrate REST API development and system integration experience.

R5 — Public-Sector Digital Project Experience (Required)
The supplier must evidence at least one prior public-sector or municipal digital project reference.

R6 — ISO 9001 (Required)
ISO 9001 quality certification is required.

R7 — ISO 27001 (MANDATORY)
ISO 27001 information security certification is mandatory for this tender.

R8 — 24/7 Technical Support (Required)
The supplier must provide 24/7 technical support / service desk coverage for the platform.

R9 — Minimum previous contract experience of MAD 1,000,000 (Required)
The supplier must demonstrate previous contract experience of at least MAD 1,000,000.

R10 — Healthcare Information System Experience (Preferred — NOT mandatory)
Healthcare information system experience is preferred but not mandatory.

R11 — Morocco-based delivery capability (Required)
The supplier must demonstrate Morocco-based or Morocco nationwide delivery capability.

R12 — Financial and operational capacity for an 8-month project (Required)
The supplier must demonstrate financial and operational capacity to deliver an 8-month project with a compact multidisciplinary team.

EVALUATION CRITERIA
Award will consider technical fit, compliance with mandatory requirements, delivery capacity, and commercial proposal.

Tenderers shall provide supporting evidence. Missing mandatory certifications or unsupported mandatory requirements may result in disqualification.
`.trim();

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const doc = new PDFDocument({ margin: 50, size: "A4" });
  const stream = fs.createWriteStream(OUT_FILE);
  doc.pipe(stream);

  doc.fontSize(14).text("National Public Services Authority", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(16).text("Digital Citizen Services Platform", { align: "center", underline: true });
  doc.moveDown();
  doc.fontSize(10).text(BODY, { align: "left", lineGap: 2 });

  doc.end();
  await new Promise<void>((resolve, reject) => {
    stream.on("finish", () => resolve());
    stream.on("error", reject);
  });
  console.log("Wrote", OUT_FILE);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
