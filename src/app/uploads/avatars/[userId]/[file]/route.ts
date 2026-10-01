import {
  contentTypeForAvatarFilename,
  resolveSafeAvatarFilePath,
} from "@/lib/public-uploads";
import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ userId: string; file: string }> };

/**
 * Serve profile photos from PUBLIC_UPLOADS_ROOT (or public/uploads default).
 * Keeps DB URLs as /uploads/avatars/{userId}/{file} so existing rows keep working
 * across multi-instance deploys that share one uploads volume.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const { userId, file } = await params;
  const absolute = resolveSafeAvatarFilePath(userId, file);
  if (!absolute) {
    return new NextResponse("Not found", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }

  if (!existsSync(absolute)) {
    return new NextResponse("Not found", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const type = contentTypeForAvatarFilename(file);
  if (!type) {
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
