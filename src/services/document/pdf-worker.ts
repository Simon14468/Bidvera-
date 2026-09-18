import { existsSync } from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { logInfo, logError } from "@/services/observability";

type PdfParseModule = typeof import("pdf-parse");
type WorkerModule = typeof import("pdf-parse/worker");

let cachedWorkerSrc: string | null = null;
let canvasFactory: WorkerModule["CanvasFactory"] | null = null;

/**
 * Official pdf-parse v2 worker setup for Node / Next.js (dev + production).
 * @see https://github.com/mehmet-kozan/pdf-parse/blob/main/docs/troubleshooting.md
 *
 * Prefer getData() (inline worker) so Windows/Turbopack never look under `.next/.../pdf.worker.mjs`.
 * Fall back to getPath() as a file:// URL.
 */
export async function ensurePdfWorker(): Promise<string> {
  if (cachedWorkerSrc) return cachedWorkerSrc;

  // Side-effect import first (official recommendation), then named exports.
  await import("pdf-parse/worker");
  const workerMod = (await import("pdf-parse/worker")) as WorkerModule;
  const { PDFParse } = (await import("pdf-parse")) as PdfParseModule;

  canvasFactory = workerMod.CanvasFactory ?? null;

  let configured: string | null = null;

  try {
    if (typeof workerMod.getData === "function") {
      const data = workerMod.getData();
      PDFParse.setWorker(data);
      configured = "pdf-parse/worker#getData";
    }
  } catch (error) {
    logError("pdf.worker.getData_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
  }

  if (!configured) {
    let workerPath =
      typeof workerMod.getPath === "function" ? workerMod.getPath() : "";
    if (!workerPath || (!workerPath.startsWith("file:") && !existsSync(workerPath))) {
      workerPath = path.join(
        process.cwd(),
        "node_modules",
        "pdf-parse",
        "dist",
        "worker",
        "pdf.worker.mjs",
      );
    }
    const asUrl =
      workerPath.startsWith("file:") || workerPath.startsWith("http")
        ? workerPath
        : pathToFileURL(workerPath).href;
    PDFParse.setWorker(asUrl);
    configured = asUrl;
  }

  cachedWorkerSrc = configured;
  logInfo("pdf.worker.configured", { source: configured });
  return configured;
}

/** CanvasFactory for PDFParse options (Node / serverless). */
export async function getPdfCanvasFactory(): Promise<
  WorkerModule["CanvasFactory"] | undefined
> {
  await ensurePdfWorker();
  return canvasFactory ?? undefined;
}

export async function createPdfParser(data: Uint8Array) {
  await ensurePdfWorker();
  const { PDFParse } = await import("pdf-parse");
  const CanvasFactory = await getPdfCanvasFactory();
  return new PDFParse(
    CanvasFactory ? { data, CanvasFactory } : { data },
  );
}
