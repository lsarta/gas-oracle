/**
 * One-shot demo warmup: fires N paid x402 oracle queries so /stats's
 * agent-query-rate tile reads non-zero before a recording. Hits the
 * /api/oracle/cheapest-{gas,parking} endpoints directly via GatewayClient
 * so --vertical actually controls which endpoint is queried — bypasses
 * /api/cron/agent's epoch-minute parity selection.
 *
 * Replaces the ad-hoc `for i; curl …` keep-warm loops we ran during the
 * 2026-05-19 session. Bounded burst only (no continuous mode), per the
 * no-manufactured-metrics convention.
 *
 * Usage:
 *   npm run warmup
 *   npm run warmup -- --count 8 --interval-seconds 6
 *   npm run warmup -- --vertical parking --count 3
 *   npm run warmup -- --host http://localhost:3001 --dry-run
 */
import { parseArgs } from "node:util";
import { GatewayClient } from "@circle-fin/x402-batching/client";
import { ensureGatewayBalance } from "./_gateway-balance";

const DEFAULT_HOST = "https://www.gyasss.com";
const DEFAULT_COUNT = 5;
const DEFAULT_INTERVAL_S = 8;
const DEFAULT_VERTICAL = "both";
const DEFAULT_SECRET_ENV = "ROUTING_AGENT_PRIVATE_KEY";
const COST_PER_TICK_USDC = 0.001;
const COUNT_CAUTION_THRESHOLD = 20;

const SF_LAT = 37.7749;
const SF_LNG = -122.4194;
const JITTER = 0.02;
const RADIUS_MINUTES = 10;

type Vertical = "gas" | "parking" | "both";

function isVertical(v: string): v is Vertical {
  return v === "gas" || v === "parking" || v === "both";
}

function nowHMS(): string {
  return new Date().toTimeString().slice(0, 8);
}

function randomLatLng(): { lat: number; lng: number } {
  return {
    lat: SF_LAT + (Math.random() - 0.5) * 2 * JITTER,
    lng: SF_LNG + (Math.random() - 0.5) * 2 * JITTER,
  };
}

function pickVertical(mode: Vertical, tickIdx: number): "gas" | "parking" {
  if (mode === "gas") return "gas";
  if (mode === "parking") return "parking";
  return tickIdx % 2 === 1 ? "gas" : "parking";
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const { values } = parseArgs({
    options: {
      host: { type: "string", default: DEFAULT_HOST },
      count: { type: "string", short: "c", default: String(DEFAULT_COUNT) },
      "interval-seconds": {
        type: "string",
        short: "i",
        default: String(DEFAULT_INTERVAL_S),
      },
      vertical: { type: "string", default: DEFAULT_VERTICAL },
      "secret-env": { type: "string", default: DEFAULT_SECRET_ENV },
      "dry-run": { type: "boolean", default: false },
    },
    strict: true,
  });

  const host = values.host as string;
  const countRaw = values.count as string;
  const intervalRaw = values["interval-seconds"] as string;
  const verticalRaw = values.vertical as string;
  const secretEnv = values["secret-env"] as string;
  const dryRun = values["dry-run"] as boolean;

  const count = Number.parseInt(countRaw, 10);
  if (!Number.isInteger(count) || count <= 0) {
    console.error(
      `[warmup] --count must be a positive integer (got: ${countRaw})`,
    );
    process.exit(2);
  }
  const intervalSec = Number.parseFloat(intervalRaw);
  if (!Number.isFinite(intervalSec) || intervalSec <= 0) {
    console.error(
      `[warmup] --interval-seconds must be a positive number (got: ${intervalRaw})`,
    );
    process.exit(2);
  }
  if (!isVertical(verticalRaw)) {
    console.error(
      `[warmup] --vertical must be one of gas|parking|both (got: ${verticalRaw})`,
    );
    process.exit(2);
  }
  const vertical: Vertical = verticalRaw;

  const totalCostUsdc =
    Math.round(count * COST_PER_TICK_USDC * 1_000_000) / 1_000_000;
  const durationS = count * intervalSec;
  const etaISO = new Date(Date.now() + durationS * 1000)
    .toTimeString()
    .slice(0, 8);

  console.log(`target          ${host}`);
  console.log(`count           ${count}`);
  console.log(`interval        ${intervalSec}s`);
  console.log(`vertical        ${vertical}`);
  console.log(`signer (env)    $${secretEnv}`);
  console.log(`est. duration   ${durationS}s (done by ~${etaISO})`);
  console.log(
    `est. cost       $${totalCostUsdc.toFixed(6)} USDC (${count} × $${COST_PER_TICK_USDC})`,
  );
  if (count > COUNT_CAUTION_THRESHOLD) {
    console.log(
      `note            count=${count} > ${COUNT_CAUTION_THRESHOLD}; ensure this matches a plausible organic burst`,
    );
  }

  // Dry-run short-circuit BEFORE the secret check — operators rehearsing
  // a plan don't need a live signing key to see the plan.
  if (dryRun) {
    console.log(`\n--dry-run set; exiting without firing.`);
    return;
  }

  const pk = process.env[secretEnv];
  if (!pk) {
    console.error(`\n[warmup] env var "${secretEnv}" is not set.`);
    console.error(
      `         Define it in .env.local, or pass a different name with --secret-env <NAME>.`,
    );
    process.exit(2);
  }

  let interrupted = false;
  process.on("SIGINT", () => {
    interrupted = true;
  });

  const client = new GatewayClient({
    chain: "arcTestnet",
    privateKey: pk as `0x${string}`,
  });

  // Pre-flight: ensure Gateway has enough balance to cover the burst. If
  // below threshold, deposit. Failures here are fatal — the operator
  // should see a clear message rather than discover failed ticks one by one.
  try {
    const { available, deposited } = await ensureGatewayBalance(client);
    const balanceLabel = Number.isFinite(available)
      ? `$${available.toFixed(3)} USDC`
      : "balance unknown";
    console.log(
      `gateway         ${balanceLabel}${deposited ? " (topped up)" : " (sufficient)"}`,
    );
  } catch (e) {
    console.error(`\n[warmup] ${e instanceof Error ? e.message : e}`);
    process.exit(2);
  }
  console.log("");

  let ok = 0;
  let fail = 0;
  const startMs = Date.now();

  for (let i = 1; i <= count; i++) {
    if (interrupted) {
      console.log(`[${nowHMS()}] interrupted before tick ${i}`);
      break;
    }
    const v = pickVertical(vertical, i);
    const { lat, lng } = randomLatLng();
    const path =
      v === "gas" ? "/api/oracle/cheapest-gas" : "/api/oracle/cheapest-parking";
    const url = `${host}${path}?lat=${lat.toFixed(4)}&lng=${lng.toFixed(4)}&radiusMinutes=${RADIUS_MINUTES}`;

    const tickStart = Date.now();
    try {
      const result = (await client.pay(url)) as {
        paymentResponse?: { transaction?: string };
        transaction?: string;
        formattedAmount?: string;
      };
      const tx =
        result.paymentResponse?.transaction ?? result.transaction ?? "?";
      const paid =
        result.formattedAmount ?? COST_PER_TICK_USDC.toFixed(3);
      const elapsedS = ((Date.now() - tickStart) / 1000).toFixed(1);
      console.log(
        `[${nowHMS()}] ${i}/${count}  ${v.padEnd(7)} ok    tx=${tx.slice(0, 14)}…  paid=$${paid}  total=${elapsedS}s`,
      );
      ok++;
    } catch (e) {
      const elapsedS = ((Date.now() - tickStart) / 1000).toFixed(1);
      console.error(
        `[${nowHMS()}] ${i}/${count}  ${v.padEnd(7)} FAIL  total=${elapsedS}s  ${e instanceof Error ? e.message : e}`,
      );
      fail++;
    }
    if (i < count && !interrupted) {
      await sleep(intervalSec * 1000);
    }
  }

  const totalDurationS = ((Date.now() - startMs) / 1000).toFixed(1);
  const paidTotalUsdc = (ok * COST_PER_TICK_USDC).toFixed(6);
  console.log(
    `\nfinal: ok=${ok}  fail=${fail}  duration=${totalDurationS}s  paid=$${paidTotalUsdc} USDC`,
  );

  if (interrupted) process.exit(130);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("[warmup] fatal:", e);
  process.exit(1);
});
