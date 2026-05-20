/**
 * Shared Gateway-balance utilities for scripts.
 *
 * The SDK's `getBalances()` response shape has shifted between versions —
 * this helper tries multiple candidate fields so older callers don't break
 * when the SDK bumps. The first match wins.
 */
import { GatewayClient } from "@circle-fin/x402-batching/client";

export const DEFAULT_MIN_GATEWAY_BALANCE_USDC = 0.1;
export const DEFAULT_DEPOSIT_USDC = "0.5";

/** Best-effort extraction of "available USDC in Gateway" from a SDK
 *  getBalances() response. Returns NaN if no candidate yielded a finite
 *  number — callers should treat that as "unknown, top up to be safe."
 *
 *  Candidates are ordered current → legacy. The current SDK (3.0.4) exposes
 *  `gateway.formattedAvailable` as a decimal string (e.g. "0.913"); earlier
 *  shapes used nested objects with `.formatted` or a different field name. */
export function gatewayAvailable(b: unknown): number {
  const x = b as Record<string, unknown>;
  const gateway = x?.gateway as Record<string, unknown> | undefined;
  const candidates: unknown[] = [
    // Current SDK 3.0.4 — top-level field on the gateway object.
    gateway?.formattedAvailable,
    // Legacy shapes (kept for resilience against SDK drift).
    (gateway?.available as Record<string, unknown> | undefined)?.formatted,
    gateway?.availableFormatted,
    (x?.gatewayAvailable as Record<string, unknown> | undefined)?.formatted,
    (x?.available as Record<string, unknown> | undefined)?.formatted,
  ];
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n)) return n;
  }
  return Number.NaN;
}

export type EnsureBalanceResult = {
  /** Available USDC after the check (post-deposit if applicable). NaN if
   *  the balance couldn't be parsed, even after a successful deposit. */
  available: number;
  /** True if a deposit was issued during the check. */
  deposited: boolean;
};

/** Read the Gateway's available balance; if below `minUsdc`, deposit
 *  `depositUsdc`. Throws with a clear message if the deposit fails — caller
 *  should treat that as fatal (exit non-zero) so the operator knows the
 *  signer wallet needs on-chain USDC + native gas. */
export async function ensureGatewayBalance(
  client: GatewayClient,
  options?: { minUsdc?: number; depositUsdc?: string },
): Promise<EnsureBalanceResult> {
  const min = options?.minUsdc ?? DEFAULT_MIN_GATEWAY_BALANCE_USDC;
  const depositAmount = options?.depositUsdc ?? DEFAULT_DEPOSIT_USDC;

  const balances = await client.getBalances();
  const available = gatewayAvailable(balances);

  if (Number.isFinite(available) && available >= min) {
    return { available, deposited: false };
  }

  try {
    await client.deposit(depositAmount);
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    throw new Error(
      `Gateway top-up of $${depositAmount} USDC failed: ${reason}. ` +
        `Ensure the signer wallet has at least $${depositAmount} on-chain USDC plus native gas.`,
    );
  }

  // Re-read to report the new balance; tolerate read failure since the
  // deposit itself already succeeded.
  let postAvailable = Number.NaN;
  try {
    const post = await client.getBalances();
    postAvailable = gatewayAvailable(post);
  } catch {
    /* ignore — deposit confirmed, just couldn't re-read */
  }
  return { available: postAvailable, deposited: true };
}
