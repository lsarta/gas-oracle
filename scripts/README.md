# scripts/

One-off scripts for seeding, debugging, and running the routing agent.
Each script is invoked with `tsx --env-file=.env.local`. The most common
ones have npm aliases (see `package.json`).

## Demo-state lifecycle

These are the only scripts you should typically need between now and the
May 28 demo recording.

### `seed-demo-state.ts` — idempotent demo seeder

Resets the public DB to a known-good demo state. Safe to re-run any number
of times — every demo-seeded row is tagged with a synthetic wallet
(`^0x0{30,}`) that is cleared up-front on each run.

```sh
# With demo wallet (recommended — sets home/work + preferences):
npm run db:seed:demo -- 0xYourPrivyEmbeddedWallet

# Or via env var:
DEMO_WALLET=0xYourPrivyEmbeddedWallet npm run db:seed:demo

# Without a wallet (seeds market data only):
npm run db:seed:demo
```

What it does:

1. Ensures the 25 SF stations and 12 SF parking locations from
   `gyasss-demo-data-spec.md` exist in the catalog (calls `seedStations`
   / `seedParking` inline).
2. Deletes prior synthetic demo rows (`reports` and `stakes` with
   wallet `^0x0{30,}`).
3. Inserts 5-10 fresh reports per station within the last 2 hours,
   prices clustered tightly around the listed price, timestamps spread
   so consensus dominance stays under 70% (i.e. `high` confidence).
4. Refreshes 10 parking locations to <2h; intentionally leaves Civic
   Center Garage and Lombard Garage stale (14-22h, surfaces the
   freshness/bounty UX during the demo).
5. Configures the demo wallet's `users` row with home (Pacific Heights,
   2398 Pacific Ave), work (345 California St), `hourly_value_usd=75`,
   `avg_mpg=25`, `typical_fillup_gallons=12`.
6. Checks `oracle_queries` activity for the last 24h. If sparse
   (<80 events), prints the command to top up via the routing agent —
   does **not** auto-spawn (the routing agent loops indefinitely,
   requires a local dev server, and spends real USDC).
7. Prints a verification summary.

**The wallet must already exist in the `users` table.** Sign in once at
https://www.gyasss.com to create the row before running the script.

### `reset-demo-state.ts` — companion cleanup

Removes synthetic demo rows without re-seeding. Stations and parking
locations (the catalog) are preserved.

```sh
npm run db:reset:demo
```

## Catalog seeds (rarely run on their own)

These define the source-of-truth station and parking catalogs that
`seed-demo-state` builds on. Run individually only if you need to
populate the catalog without the demo flavor.

| Script | npm alias | What |
|---|---|---|
| `db-seed.ts` | `npm run db:seed` | 25 SF gas stations |
| `db-seed-parking.ts` | `npm run db:seed:parking` | 12 SF parking locations |

## Activity top-up

If `seed-demo-state` reports sparse activity, run the routing agent
against a local dev server to populate `oracle_queries` with authentic
on-chain x402 payments (real Arc tx hashes, clickable in the activity
feed).

```sh
# Terminal A:
npm run dev

# Terminal B (let run ~8-10 min):
npm run agent:run
```

Each query costs ~$0.001 USDC. The first run also deposits 0.5 USDC into
the Gateway balance if needed. Required env vars: `ROUTING_AGENT_PRIVATE_KEY`.

## Other scripts

| Script | When to use |
|---|---|
| `db-migrate.ts` | Apply pending SQL migrations in `scripts/migrations/` |
| `db-check-users.ts` / `db-check-queries.ts` | Inspect DB state |
| `cleanup-test-data.ts` | Remove rows from `test-*.ts` runs (different wallet pattern than demo seeds) |
| `check-balances.ts` | Read master + routing-agent USDC balances on Arc |
| `probe-master-wallet.ts` | Scan recent USDC transfers in/out of master wallet |
| `seed-demo-commute.ts` | (Legacy) older Steuart→MindsDB commute demo. Superseded by `seed-demo-state.ts`. |
| `seed-consensus-demo.ts` | Seed a specific outlier-resistant consensus scenario for the trust-layer demo segment |
