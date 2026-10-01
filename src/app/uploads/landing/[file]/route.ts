import { resolveLandingUploadsRoot } from "@/lib/public-uploads";
import { existsSync } from "fs";
import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LANDING_EXT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
};

type RouteParams = { params: Promise<{ file: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const { file } = await params;
  if (
    !file ||
    file.includes("..") ||
    file.includes("/") ||
    file.includes("\\")
  ) {
    return new NextResponse("Not found", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const type = LANDING_EXT_TYPES[path.extname(file).toLowerCase()];
  if (!type) {
    return new NextResponse("Not found", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const root = path.resolve(resolveLandingUploadsRoot());
  const absolute = path.resolve(root, file);
  if (!absolute.startsWith(root + path.sep) || !existsSync(absolute)) {
    return new NextResponse("Not found", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }

  try {
    const body = await readFile(absolute);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": type,
        "Content-Length": String(body.byteLength),
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse("Not found", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
