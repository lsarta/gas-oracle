ALTER TABLE savings_events
  ADD COLUMN IF NOT EXISTS net_savings_usd numeric(10,2),
  ADD COLUMN IF NOT EXISTS detour_minutes numeric(5,1),
  ADD COLUMN IF NOT EXISTS detour_miles numeric(5,2);
