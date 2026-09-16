ALTER TABLE operation_tasks
ADD COLUMN source_anomaly_id TEXT;

CREATE TABLE governance_tasks (
  id TEXT PRIMARY KEY,
  source_anomaly_id TEXT,
  title TEXT NOT NULL,
  instruction TEXT NOT NULL,
  owner TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending', 'closed')),
  created_at TEXT NOT NULL,
  closed_at TEXT,
  resolution TEXT
);

CREATE INDEX idx_governance_tasks_source_status
ON governance_tasks(source_anomaly_id, status);
