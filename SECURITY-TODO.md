# Security & quality TODO — post May 28 demo

Tracked work from the 2026-05-20 security audit on branch `security-hardening`.
Items below are **deliberately deferred** until after the May 28 demo to avoid
risking demo-critical paths under deadline pressure. The "BEFORE May 28" items
land on this branch first; everything here waits.

Cross-reference: the original audit lives in the 2026-05-20 conversation
transcript. Items are organized by attack surface, not by audit priority.

---

## 1. P0 — Caller-supplied wallet trust (full auth refactor)

The four payout / state-mutating endpoints currently accept `userWallet` or
`walletAddress` as a body/query field with only regex validation. There is no
proof the caller controls that wallet, so any caller can:

- Direct cashback payouts to any address (`/api/reports`)
- Inscribe "staked" reports under any wallet and trigger stake+bounty payouts
  to that wallet on resolve (`/api/stakes/submit` + `lib/oracle/resolve-stakes.ts`)
- Overwrite anyone's preferences (`/api/users/update`)
- Squat on someone else's `privy_user_id` (`/api/users/upsert`)
- Disclose any user's email + earnings (`/api/users/me?wallet=…`)
- Likely also affects `/api/savings/take` (same trust pattern, needs full read)

### Fix scope

**New file:** `src/lib/auth/verify-privy.ts` — wraps `@privy-io/node`
(NOT `@privy-io/server-auth`, which is deprecated). The access token verifies
a Privy DID, **not a wallet** — so the canonical server-side identity becomes
`privy_user_id`, and the wallet is derived server-side from the DID. All
client-supplied wallet fields are ignored.

**Open design decision (pick one when P0 starts, not earlier):**

- **(A) Identity-token path** — client sends Privy *identity token* alongside
  the access token (or instead of); server validates and reads the embedded
  EVM wallet directly from the token's `linked_accounts` claim. **Pros:** zero
  extra Privy API calls per request. **Cons:** more client plumbing — every
  fetch site (4 components) needs to pull the identity token from the Privy
  SDK and include it in the header.
- **(B) Access-token + fetch-by-DID path** — server validates the access
  token (gets DID), then calls Privy's `getUser(did)` API to fetch the user
  record and select the embedded EVM wallet. **Pros:** simpler client (just
  the access token they already have). **Cons:** one extra Privy API call
  per protected request — latency + rate-limit exposure.

Decide based on (a) measured Privy latency at our request volume and (b)
whether the client's existing Privy session already exposes the identity
token without extra work. Document the choice in the PR.

**Server routes that change:**
- `src/app/api/reports/route.ts` — replace `body.userWallet` with verified wallet
- `src/app/api/stakes/submit/route.ts` — same
- `src/app/api/users/update/route.ts` — drop `walletAddress` from body schema
- `src/app/api/users/upsert/route.ts` — verify token, derive walletAddress from
  the token's embedded wallet; reject if `privyUserId` in token ≠ body
- `src/app/api/users/me/route.ts` — drop `?wallet=` query param; return only
  the caller's own record
- `src/app/api/savings/take/route.ts` — same as reports

**Client sites that need the Authorization header:**
- `src/components/ReportDialog.tsx:224` — `POST /api/reports`
- `src/components/ReportDialog.tsx:257` — `POST /api/stakes/submit`
- `src/app/settings/page.tsx:252` — `POST /api/users/update`
- `src/components/OnboardingModal.tsx:261` — `POST /api/users/update`
- `src/components/UserSync.tsx` — `POST /api/users/upsert`
- (Audit-time check) any new caller wired up before this lands

**Env / deps:**
- Add `PRIVY_APP_SECRET` to Vercel production env
- Add `@privy-io/node` to `package.json`. Do **not** use `@privy-io/server-auth`
  (deprecated).

**Note: `/api/users/upsert` binding bug (audit item 2.7) fixes for free** once
auth is DID-based. The server derives both `privy_user_id` and the embedded
wallet from the verified token; the body schema drops `privyUserId` and
`walletAddress` entirely. Codex's re-review caught this dependency.

### Verification (manual — no test suite exists)

1. Attack curl: `POST /api/reports` with a foreign wallet + forged/missing
   token → expect 401
2. Real-user path: sign in via Privy, submit a report, confirm cashback lands
3. Settings save & clear still work
4. `/api/users/me` returns the caller's own row; refuses cross-tenant reads

### Open design decision

How to take real stake escrow once auth lands:
- (a) **Stays bounty-only / corroboration-only** (the May 28 shipped state —
  `resolve-stakes.ts:79` pays bounty only, stake_amount column is informational
  intent). No USDC ever moves into escrow.
- (b) Privy admin-API transfer from user's embedded wallet to master — real
  implementation; uses `PRIVY_APP_SECRET`. Restores the actual financial
  stake-and-slash mechanic.
- (c) x402 client-side payment — requires the user to have a funded Gateway
  balance, adds UX friction.

Decide based on whether the financial stake-and-slash mechanic still has
product gravity post-demo. (a) is the no-op continuation of the pre-demo
state.

---

## 2. Adjacent issues surfaced by the audit

These weren't in the original review brief; surface them while doing the P0
work so the fix isn't half-done.

### 2.1 Self-confirming stake exploit

`resolvePendingStakes` (`src/lib/oracle/resolve-stakes.ts`) runs on every
`POST /api/reports`. Combined with caller-supplied `userWallet`, an attacker
can:
1. Stake a report at a stale station
2. Submit two follow-up reports themselves with prices close to the staked
   price (free with auth bypass; ~$0 with real auth at this scale)
3. Mini-consensus passes → confirm → master pays stake + bounty

Fix: after P0 lands, also gate the *follow-up* reports — require N reports
from distinct wallets before a stake resolves, OR exclude reports from the
staker themselves from the resolution-counting window.

### 2.2 Confidence-gaming bypasses outlier halving

`src/app/api/reports/route.ts:99-101`:
```ts
const wasOutlier = priorConsensus.confidence === "high" && isOutlier(…)
```
If an attacker spreads early prices wide enough to keep confidence below
`high`, outlier detection never fires and `payoutAmount` stays at full
freshness rate. Fix options: trigger outlier check at `medium` too, or weight
recent reports by reporter diversity.

### 2.3 No rate limiting

None of `/api/reports`, `/api/stakes/submit`, `/api/users/update`,
`/api/cron/agent`, or `/api/users/me` have rate limits. Even with auth, a
compromised wallet can spam. Add per-wallet rate limits at the route layer
(e.g. Upstash Redis token bucket or simple per-IP+per-wallet sliding window
in Postgres).

### 2.4 PII disclosure on `/api/users/me`

Returns `email` and `total_earned_usdc` for any 0x address queried. After P0
this is gated by auth, but worth confirming the response shape doesn't leak
data the caller shouldn't see (e.g. don't return PII for caller-owned-but-
queried-with-mismatched-token cases).

### 2.5 CRON_SECRET rotation

The current `CRON_SECRET` has been visible in multiple terminal sessions
including the 2026-05-19 debug session. Rotate after P0 + P1 land. Update
GHA repo secret + Vercel env in one step.

### 2.6 Synthetic-wallet guard

The demo-seed convention `^0x0{30,}` produces "wallets" with no signer. Even
after P0, add a server-side reject on payout when the recipient address
matches this pattern — defense in depth against any future bypass sending
USDC to unrecoverable addresses.

### 2.7 `/api/users/upsert` doesn't bind privyUserId to walletAddress

Even pre-auth, this accepts both as independent body fields. After P0
verifies the token, also confirm `token.privyUserId === body.privyUserId`
and `token.embeddedWalletAddress === body.walletAddress` (or just drop both
body fields and derive from token).

### 2.8 Outlier-detection bypass on freshness-payout farming

Related to 2.2. The freshness payout (`computeFreshnessPayout`) gives full
cashback for first reports on stale stations. Without per-wallet limits, a
single attacker post-P0 can still farm freshness payouts across all 25
stations every demo-state refresh cycle. Fix: cap cashback per wallet per
station per N hours.

---

## 3. Lint hook refactors (done properly)

10 `react-hooks/set-state-in-effect` errors across 7 demo-critical components,
demoted to warnings for the May 28 demo to avoid risky pre-deadline refactors.
(The 11th + the ref-read bug at `stats/page.tsx:187` are fixed pre-demo per
Codex re-review — the ref-read was behaviorally broken, not just lint-red.)

Files to fix properly post-demo:

| File | Line(s) | Pattern |
|---|---|---|
| `src/app/route/[stationId]/RouteView.tsx` | 165 | `setLoaded(true)` inside effect on auth-not-ready branch |
| `src/app/settings/page.tsx` | 78, 247 | Settings form sync effects |
| `src/app/stats/page.tsx` | 113 | Stats fetch effect |
| `src/components/EarningsPanel.tsx` | 20 | Earnings sync effect |
| `src/components/OnboardingModal.tsx` | 55 | Modal initial-state effect |
| `src/components/OpportunityCard.tsx` | 136, 153 | Card derived-state effects |
| `src/components/ReportDialog.tsx` | 126, 184 | Dialog reset + auto-fill effects |

Each effect needs case-by-case review: move setState into the relevant event
handler, derive via `useMemo`, or use the appropriate React 19 pattern.
Manual smoke test required per file because there are no tests.

Once all 10 are clean, restore `react-hooks/set-state-in-effect` to `error` in
`eslint.config.mjs`.

---

## 4. Optional: offline-build fix

`src/app/layout.tsx` imports `Geist`, `Geist_Mono`, `Inter` from
`next/font/google`, which requires network at build time. Vercel always has
network, so prod builds work. Local/CI offline builds fail.

If offline builds become important (e.g. for a self-hosted CI on a private
network), swap to `next/font/local` with the woff2 files vendored under
`public/fonts/`. Not currently a blocker.

---

## Sequencing for post-May-28 work

Suggested order, lowest risk first:

1. Rotate `CRON_SECRET` (#2.5) — independent, ~5 min
2. Synthetic-wallet guard (#2.6) — single-line server-side check, low risk
3. P0 auth refactor (#1) — biggest piece, includes #2.7
4. Adjacent farming/exploit hardening (#2.1, #2.2, #2.3, #2.4, #2.8) — once
   auth is the floor, these are the next layer
5. Lint hook refactors (#3) — pure quality, can interleave with above
6. Offline-build (#4) — only if needed
