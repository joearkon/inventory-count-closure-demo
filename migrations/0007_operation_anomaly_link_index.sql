CREATE INDEX IF NOT EXISTS idx_operation_tasks_source_anomaly_created
ON operation_tasks(source_anomaly_id, created_at DESC);
