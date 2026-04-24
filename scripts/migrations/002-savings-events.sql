CREATE TABLE IF NOT EXISTS savings_events (
  id uuid primary key default gen_random_uuid(),
  user_wallet text not null,
  station_id uuid references stations(id) on delete set null,
  estimated_savings_usd numeric(10,2) not null,
  recommended_price numeric(10,3) not null,
  baseline_price numeric(10,3) not null,
  gallons_assumed numeric(8,3) not null default 12.0,
  source text not null check (source in ('opportunity_taken','manual')),
  created_at timestamptz default now()
);

CREATE INDEX IF NOT EXISTS idx_savings_user ON savings_events(user_wallet);
CREATE INDEX IF NOT EXISTS idx_savings_created ON savings_events(created_at desc);
