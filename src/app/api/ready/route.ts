import { NextResponse } from "next/server";
import { getPublicReadyStatus } from "@/services/production-readiness/checks";

export const dynamic = "force-dynamic";

/**
 * Readiness: real backend checks (DB, storage write, critical prod config).
 * Never returns secrets, database URLs, internal paths, or itemized config.
 */
export async function GET() {
  const result = await getPublicReadyStatus();
  return NextResponse.json(
    {
      ready: result.ready,
      status: result.status,
      service: "bidvera",
      ts: result.ts,
    },
    { status: result.ready ? 200 : 503 },
  );
}
