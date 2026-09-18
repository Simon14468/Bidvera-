import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Liveness: process is up. Does not probe dependencies.
 * Load balancers that only need "process alive" should use this.
 * `instance` helps operators verify which upstream answered (multi-instance).
 */
export async function GET() {
  const port = process.env.PORT ?? "3000";
  const host = process.env.HOSTNAME ?? "0.0.0.0";
  return NextResponse.json({
    ok: true,
    service: "bidvera",
    instance: process.env.INSTANCE_ID?.trim() || `${host}:${port}`,
    ts: new Date().toISOString(),
  });
}
