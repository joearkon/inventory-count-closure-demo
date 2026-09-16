CREATE TABLE operation_tasks (
  id TEXT PRIMARY KEY,
  store_code TEXT NOT NULL,
  task_type TEXT NOT NULL,
  title TEXT NOT NULL,
  instruction TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending_store_submission', 'pending_hq_review', 'closed')),
  assigned_to TEXT NOT NULL,
  created_at TEXT NOT NULL,
  submitted_at TEXT,
  proof_filename TEXT,
  closed_at TEXT,
  resolution TEXT
);

CREATE INDEX idx_operation_tasks_store_status
ON operation_tasks(store_code, status);
