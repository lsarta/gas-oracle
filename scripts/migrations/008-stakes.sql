CREATE TABLE IF NOT EXISTS stakes (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references reports(id) on delete cascade,
  user_wallet text not null,
  stake_amount_usdc numeric(10,6) not null,
  bounty_amount_usdc numeric(10,6) not null,
  status text not null check (status in ('pending', 'confirmed', 'slashed', 'expired')),
  resolved_at timestamptz,
  resolution_reason text,
  created_at timestamptz default now()
);

CREATE INDEX IF NOT EXISTS idx_stakes_status ON stakes(status);
CREATE INDEX IF NOT EXISTS idx_stakes_user ON stakes(user_wallet);

ALTER TABLE stations
  ADD COLUMN IF NOT EXISTS active_bounty_usdc numeric(10,6) DEFAULT 0;
