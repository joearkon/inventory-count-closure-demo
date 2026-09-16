CREATE TABLE anomaly_manual_closures (
  anomaly_id TEXT PRIMARY KEY,
  closure_reason TEXT NOT NULL,
  closed_by TEXT NOT NULL,
  closed_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_anomaly_manual_closures_closed_at
ON anomaly_manual_closures(closed_at DESC);
