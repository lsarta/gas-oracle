import { NextRequest } from "next/server";
import { GatewayClient } from "@circle-fin/x402-batching/client";

// One cron invocation = one paid oracle query, alternating gas/parking
// based on epoch-minute parity. Mirrors scripts/routing-agent.ts but
// runs on Vercel's schedule instead of a long-lived process.

// Disable Vercel's edge cache for this route. Without this, the CDN can
// HIT and serve a cached 404 from the brief window before the route was
// deployed — which masks both manual curl tests and the cron's own calls.
export const dynamic = "force-dynamic";
export const revalidate = 0;

const HOST_FALLBACK = "https://www.gyasss.com";
const GAS_PATH = "/api/oracle/cheapest-gas";
const PARKING_PATH = "/api/oracle/cheapest-parking";
const SF_LAT = 37.7749;
const SF_LNG = -122.4194;
const JITTER = 0.02;
const MIN_GATEWAY_BALANCE_USDC = 0.1;
const DEPOSIT_AMOUNT_USDC = "0.5";

function gatewayAvailable(b: unknown): number {
  const x = b as Record<string, unknown>;
  const candidates = [
    (x?.gateway as Record<string, unknown> | undefined)?.available,
    (x?.gateway as Record<string, unknown> | undefined)?.availableFormatted,
    (x?.gatewayAvailable as Record<string, unknown> | undefined)?.formatted,
    (x?.available as Record<string, unknown> | undefined)?.formatted,
  ];
  for (const c of candidates) {
    if (c && typeof c === "object" && "formatted" in (c as Record<string, unknown>)) {
      const n = Number((c as Record<string, unknown>).formatted);
      if (Number.isFinite(n)) return n;
    }
    const n = Number(c as unknown);
    if (Number.isFinite(n)) return n;
  }
  return Number.NaN;
}

function checkAuth(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // No secret configured yet — refuse all requests in production.
    // (Vercel always sends an Authorization: Bearer header on cron triggers
    // when CRON_SECRET is set in the project env.)
    return false;
  }
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

function host(req: NextRequest): string {
  // When Vercel cron hits this endpoint internally, NEXT_PUBLIC_VERCEL_URL
  // (or the request origin) point at the right deployment. Fall back to the
  // production alias if neither is available.
  const fromVercel =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (fromVercel) return `https://${fromVercel}`;
  const origin = req.nextUrl.origin;
  if (origin && origin !== "null") return origin;
  return HOST_FALLBACK;
}

export async function GET(request: NextRequest) {
  if (!checkAuth(request)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }

  const pk = process.env.ROUTING_AGENT_PRIVATE_KEY;
  if (!pk) {
    return Response.json(
      { error: "ROUTING_AGENT_PRIVATE_KEY not configured" },
      { status: 500 },
    );
  }

  // Alternate gas/parking using epoch-minute parity so back-to-back
  // invocations consistently flip vertical without server-side state.
  const minute = Math.floor(Date.now() / 60_000);
  const isParking = minute % 2 === 1;
  const path = isParking ? PARKING_PATH : GAS_PATH;
  const vertical = isParking ? "parking" : "gas";

  const lat = SF_LAT + (Math.random() - 0.5) * 2 * JITTER;
  const lng = SF_LNG + (Math.random() - 0.5) * 2 * JITTER;
  const url = `${host(request)}${path}?lat=${lat.toFixed(4)}&lng=${lng.toFixed(4)}&radiusMinutes=10`;

  const client = new GatewayClient({
    chain: "arcTestnet",
    privateKey: pk as `0x${string}`,
  });

  // Top up Gateway balance if needed. Vercel function instances are
  // stateless across invocations — every call may start cold — so we
  // check balance each time.
  try {
    const balances = await client.getBalances();
    const available = gatewayAvailable(balances);
    if (!Number.isFinite(available) || available < MIN_GATEWAY_BALANCE_USDC) {
      console.log(
        `[cron-agent] depositing ${DEPOSIT_AMOUNT_USDC} USDC into Gateway (available=${available})`,
      );
      await client.deposit(DEPOSIT_AMOUNT_USDC);
    }
  } catch (err) {
    console.warn(
      `[cron-agent] balance check failed (continuing): ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  try {
    const result = await client.pay(url);
    const data = (result as { data: unknown }).data;
    const formatted =
      (result as { formattedAmount?: string }).formattedAmount ?? "0.001";
    const txHash =
      (result as { paymentResponse?: { transaction?: string } }).paymentResponse
        ?.transaction ??
      (result as { transaction?: string }).transaction ??
      null;

    console.log(
      `[cron-agent] ${vertical} ok @ (${lat.toFixed(4)}, ${lng.toFixed(4)}) — paid $${formatted} USDC`,
    );

    return Response.json({
      success: true,
      vertical,
      url,
      txHash,
      paidUsdc: Number(formatted),
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error(
      `[cron-agent] ${vertical} failed:`,
      err instanceof Error ? err.message : err,
    );
    return Response.json(
      {
        success: false,
        vertical,
        url,
        error: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      },
      { status: 502 },
    );
  }
}
