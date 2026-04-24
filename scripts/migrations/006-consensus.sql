ALTER TABLE stations
  ADD COLUMN IF NOT EXISTS consensus_confidence text
    CHECK (consensus_confidence IN ('high', 'medium', 'low')),
  ADD COLUMN IF NOT EXISTS consensus_report_count int DEFAULT 0;

ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS consensus_at_report numeric(10,3),
  ADD COLUMN IF NOT EXISTS was_outlier boolean DEFAULT false;
