import { NextRequest } from "next/server";
import { privateKeyToAccount } from "viem/accounts";
import { BatchFacilitatorClient } from "@circle-fin/x402-batching/server";
import {
  USDC_ADDRESS_ARC_TESTNET,
  GATEWAY_WALLET_ADDRESS_ARC_TESTNET,
} from "@/lib/chains";
import { createClient } from "@/lib/db/client";

const NETWORK = "eip155:5042002" as const;
const SCHEME = "exact" as const;
const PRICE_ATOMIC = "1000"; // $0.001 in USDC atomic units (6 decimals)
const PRICE_USD = 0.001;
const FACILITATOR_URL = "https://gateway-api-testnet.circle.com";
const MILES_PER_MINUTE = 0.6;

function payTo(): string {
  const pk = process.env.PRIVATE_KEY;
  if (!pk) throw new Error("PRIVATE_KEY missing");
  return privateKeyToAccount(pk as `0x${string}`).address;
}

function buildRequirements() {
  return {
    scheme: SCHEME,
    network: NETWORK,
    asset: USDC_ADDRESS_ARC_TESTNET,
    amount: PRICE_ATOMIC,
    payTo: payTo(),
    maxTimeoutSeconds: 345600,
    extra: {
      name: "GatewayWalletBatched",
      version: "1",
      verifyingContract: GATEWAY_WALLET_ADDRESS_ARC_TESTNET,
    },
  };
}

function payment402(request: NextRequest): Response {
  const requirements = buildRequirements();
  const paymentRequired = {
    x402Version: 2,
    resource: {
      url: request.nextUrl.toString(),
      description: "Cheapest gas station within radius",
      mimeType: "application/json",
    },
    accepts: [requirements],
  };
  const headerVal = Buffer.from(JSON.stringify(paymentRequired)).toString("base64");
  return new Response(JSON.stringify({}), {
    status: 402,
    headers: {
      "Content-Type": "application/json",
      "PAYMENT-REQUIRED": headerVal,
    },
  });
}

function haversineMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 3958.7613; // Earth radius in miles
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const lat = Number(sp.get("lat"));
  const lng = Number(sp.get("lng"));
  const radiusMinutes = Number(sp.get("radiusMinutes") ?? "5");
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(radiusMinutes)) {
    return Response.json({ error: "lat, lng, radiusMinutes must be numbers" }, { status: 400 });
  }

  const paymentHeader =
    request.headers.get("payment-signature") ?? request.headers.get("Payment-Signature");

  if (!paymentHeader) {
    return payment402(request);
  }

  let paymentPayload: {
    x402Version: number;
    payload: Record<string, unknown>;
    accepted?: Record<string, unknown>;
    [k: string]: unknown;
  };
  try {
    paymentPayload = JSON.parse(Buffer.from(paymentHeader, "base64").toString("utf-8"));
  } catch (err) {
    return Response.json(
      { error: "Invalid payment-signature header (not base64 JSON)", detail: String(err) },
      { status: 400 },
    );
  }

  const facilitator = new BatchFacilitatorClient({ url: FACILITATOR_URL });
  const requirements = buildRequirements();

  const verifyResult = await facilitator.verify(paymentPayload, requirements);
  if (!verifyResult.isValid) {
    return new Response(
      JSON.stringify({ error: "Payment verification failed", reason: verifyResult.invalidReason }),
      {
        status: 402,
        headers: {
          "Content-Type": "application/json",
          "PAYMENT-REQUIRED": Buffer.from(
            JSON.stringify({
              x402Version: 2,
              resource: {
                url: request.nextUrl.toString(),
                description: "Cheapest gas station within radius",
                mimeType: "application/json",
              },
              accepts: [requirements],
            }),
          ).toString("base64"),
        },
      },
    );
  }

  const settleResult = await facilitator.settle(paymentPayload, requirements);
  if (!settleResult.success) {
    return new Response(
      JSON.stringify({ error: "Payment settlement failed", reason: settleResult.errorReason }),
      { status: 402, headers: { "Content-Type": "application/json" } },
    );
  }

  const callerAddress = settleResult.payer ?? verifyResult.payer ?? "unknown";

  const radiusMiles = radiusMinutes * MILES_PER_MINUTE;

  const client = createClient();
  await client.connect();

  let payload: Record<string, unknown>;
  try {
    const { rows } = await client.query(
      `SELECT id, name, address, lat, lng, current_price_per_gallon, last_priced_at
         FROM stations WHERE current_price_per_gallon IS NOT NULL`,
    );

    type Row = {
      id: string;
      name: string;
      address: string;
      lat: number;
      lng: number;
      current_price_per_gallon: string | number;
      last_priced_at: Date | null;
    };
    const candidates = (rows as Row[])
      .map((r) => ({
        ...r,
        distanceMiles: haversineMiles(lat, lng, Number(r.lat), Number(r.lng)),
      }))
      .filter((r) => r.distanceMiles <= radiusMiles)
      .sort((a, b) => Number(a.current_price_per_gallon) - Number(b.current_price_per_gallon));

    if (candidates.length === 0) {
      payload = {
        station: null,
        message: "No stations within radius.",
        queriedAt: new Date().toISOString(),
      };
    } else {
      const top = candidates[0];
      payload = {
        station: {
          name: top.name,
          address: top.address,
          lat: Number(top.lat),
          lng: Number(top.lng),
          price: Number(top.current_price_per_gallon),
          lastUpdated: top.last_priced_at ? top.last_priced_at.toISOString() : null,
        },
        distanceMiles: Math.round(top.distanceMiles * 100) / 100,
        queriedAt: new Date().toISOString(),
      };
    }

    await client.query(
      `INSERT INTO oracle_queries (caller_address, query_params, response_payload, amount_paid_usdc, payment_tx_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        callerAddress,
        JSON.stringify({ lat, lng, radiusMinutes }),
        JSON.stringify(payload),
        PRICE_USD,
        settleResult.transaction ?? null,
      ],
    );
  } finally {
    await client.end();
  }

  const settleResponseHeader = Buffer.from(
    JSON.stringify({
      success: true,
      transaction: settleResult.transaction,
      network: requirements.network,
      payer: callerAddress,
    }),
  ).toString("base64");

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "PAYMENT-RESPONSE": settleResponseHeader,
    },
  });
}
