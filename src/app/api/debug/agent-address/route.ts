import { NextRequest } from "next/server";
import { privateKeyToAccount } from "viem/accounts";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function deriveAddress(pk: string | undefined): string | null {
  if (!pk) return null;
  try {
    return privateKeyToAccount(pk as `0x${string}`).address;
  } catch {
    return "INVALID_KEY_FORMAT";
  }
}

function checkAuth(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!checkAuth(request)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }

  return Response.json({
    routingAgent: deriveAddress(process.env.ROUTING_AGENT_PRIVATE_KEY),
    merchant: deriveAddress(process.env.PRIVATE_KEY),
    environment: process.env.VERCEL_ENV ?? "local",
    deploymentUrl:
      process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL ?? null,
    timestamp: new Date().toISOString(),
  });
}
