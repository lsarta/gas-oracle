ALTER TABLE users
  ADD COLUMN IF NOT EXISTS work_lat double precision,
  ADD COLUMN IF NOT EXISTS work_lng double precision,
  ADD COLUMN IF NOT EXISTS hourly_value_usd numeric(6,2) DEFAULT 30.00,
  ADD COLUMN IF NOT EXISTS avg_mpg numeric(5,2) DEFAULT 25.00,
  ADD COLUMN IF NOT EXISTS typical_fillup_gallons numeric(5,2) DEFAULT 12.00;
