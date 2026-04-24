CREATE TABLE IF NOT EXISTS parking_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  lat double precision not null,
  lng double precision not null,
  current_hourly_rate numeric(10,2),
  last_priced_at timestamptz,
  created_at timestamptz default now(),
  unique(name, address)
);

CREATE INDEX IF NOT EXISTS idx_parking_location ON parking_locations(lat, lng);
