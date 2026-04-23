-- Gyas schema. Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS stations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  current_price_per_gallon numeric(10,3),
  last_priced_at timestamptz,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT stations_name_address_uniq UNIQUE (name, address)
);

CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id uuid REFERENCES stations(id) ON DELETE CASCADE,
  user_wallet text NOT NULL,
  transaction_amount_usd numeric(10,2) NOT NULL,
  gallons numeric(8,3),
  computed_price_per_gallon numeric(10,3),
  freshness_score numeric(6,4),
  payout_amount_usdc numeric(10,6),
  payout_tx_hash text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  privy_user_id text UNIQUE NOT NULL,
  email text,
  wallet_address text UNIQUE NOT NULL,
  total_earned_usdc numeric(12,6) DEFAULT 0,
  total_saved_usd numeric(12,2) DEFAULT 0,
  home_lat double precision,
  home_lng double precision,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS oracle_queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_address text NOT NULL,
  query_params jsonb NOT NULL,
  response_payload jsonb NOT NULL,
  amount_paid_usdc numeric(10,6) NOT NULL,
  payment_tx_id text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reports_station_id_idx ON reports(station_id);
CREATE INDEX IF NOT EXISTS reports_user_wallet_idx ON reports(user_wallet);
CREATE INDEX IF NOT EXISTS reports_created_at_idx ON reports(created_at DESC);
CREATE INDEX IF NOT EXISTS oracle_queries_created_at_idx ON oracle_queries(created_at DESC);
CREATE INDEX IF NOT EXISTS stations_lat_lng_idx ON stations(lat, lng);
