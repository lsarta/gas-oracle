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

export type CheapestRow = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  price: number;
  lastPricedAt: Date | null;
};

type FormatResponseFn = (row: CheapestRow, distanceMiles: number) => Record<string, unknown>;

export type OracleHandlerConfig = {
  /** Postgres table to query (e.g. 'stations', 'parking_locations'). */
  table: string;
  /** Column on the table holding the price/rate. */
  priceColumn: string;
  /** Vertical key — written into oracle_queries.query_params.vertical. */
  vertical: string;
  /** One-line description sent in the 402 PAYMENT-REQUIRED resource. */
  description: string;
  /** Map a winning row + distance to the JSON body returned to the agent. */
  formatResponse: FormatResponseFn;
};

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

function require402(request: NextRequest, description: string): Response {
  const requirements = buildRequirements();
  const paymentRequired = {
    x402Version: 2,
    resource: {
      url: request.nextUrl.toString(),
      description,
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
  const R = 3958.7613;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function createOracleHandler(config: OracleHandlerConfig) {
  return async function GET(request: NextRequest): Promise<Response> {
    const sp = request.nextUrl.searchParams;
    const lat = Number(sp.get("lat"));
    const lng = Number(sp.get("lng"));
    const radiusMinutes = Number(sp.get("radiusMinutes") ?? "5");
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      !Number.isFinite(radiusMinutes)
    ) {
      return Response.json(
        { error: "lat, lng, radiusMinutes must be numbers" },
        { status: 400 },
      );
    }

    const paymentHeader =
      request.headers.get("payment-signature") ??
      request.headers.get("Payment-Signature");

    if (!paymentHeader) {
      return require402(request, config.description);
    }

    let paymentPayload: {
      x402Version: number;
      payload: Record<string, unknown>;
      accepted?: Record<string, unknown>;
      [k: string]: unknown;
    };
    try {
      paymentPayload = JSON.parse(
        Buffer.from(paymentHeader, "base64").toString("utf-8"),
      );
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
        JSON.stringify({
          error: "Payment verification failed",
          reason: verifyResult.invalidReason,
        }),
        {
          status: 402,
          headers: {
            "Content-Type": "application/json",
            "PAYMENT-REQUIRED": Buffer.from(
              JSON.stringify({
                x402Version: 2,
                resource: {
                  url: request.nextUrl.toString(),
                  description: config.description,
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
        JSON.stringify({
          error: "Payment settlement failed",
          reason: settleResult.errorReason,
        }),
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
        `SELECT id, name, address, lat, lng, ${config.priceColumn} AS price, last_priced_at
           FROM ${config.table}
           WHERE ${config.priceColumn} IS NOT NULL`,
      );

      type Raw = {
        id: string;
        name: string;
        address: string;
        lat: number;
        lng: number;
        price: string | number;
        last_priced_at: Date | null;
      };
      const candidates = (rows as Raw[])
        .map((r) => ({
          id: r.id,
          name: r.name,
          address: r.address,
          lat: Number(r.lat),
          lng: Number(r.lng),
          price: Number(r.price),
          lastPricedAt: r.last_priced_at,
          distanceMiles: haversineMiles(lat, lng, Number(r.lat), Number(r.lng)),
        }))
        .filter((r) => r.distanceMiles <= radiusMiles)
        .sort((a, b) => a.price - b.price);

      if (candidates.length === 0) {
        payload = {
          [config.vertical === "gas" ? "station" : "location"]: null,
          message: "No results within radius.",
          queriedAt: new Date().toISOString(),
        };
      } else {
        const top = candidates[0];
        payload = {
          ...config.formatResponse(
            {
              id: top.id,
              name: top.name,
              address: top.address,
              lat: top.lat,
              lng: top.lng,
              price: top.price,
              lastPricedAt: top.lastPricedAt,
            },
            Math.round(top.distanceMiles * 100) / 100,
          ),
          queriedAt: new Date().toISOString(),
        };
      }

      await client.query(
        `INSERT INTO oracle_queries (caller_address, query_params, response_payload, amount_paid_usdc, payment_tx_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          callerAddress,
          JSON.stringify({ vertical: config.vertical, lat, lng, radiusMinutes }),
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
  };
}
