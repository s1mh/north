import { NextResponse } from "next/server";
import { verifyCronAuthorization } from "@/features/market/cron-auth";
import { getPrivateEnv } from "@/server/env/private";
import { runDailyMarketIngestion } from "@/server/market/run-daily-ingestion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  const { CRON_SECRET } = getPrivateEnv();
  if (!verifyCronAuthorization(request.headers.get("authorization"), CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await runDailyMarketIngestion();
    return NextResponse.json(result, {
      headers: { "cache-control": "private, no-store" },
    });
  } catch (error) {
    console.error(
      "Market snapshot failed:",
      error instanceof Error ? error.message : "unknown_error",
    );
    return NextResponse.json(
      { error: "market_snapshot_unavailable" },
      { status: 503, headers: { "cache-control": "private, no-store" } },
    );
  }
}
