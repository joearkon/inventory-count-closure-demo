CREATE TABLE inventory_tasks_next (
  id TEXT PRIMARY KEY,
  store_code TEXT NOT NULL,
  document_id TEXT NOT NULL,
  material_name TEXT NOT NULL,
  theoretical_qty REAL NOT NULL,
  initial_qty REAL NOT NULL,
  recheck_qty REAL,
  unit TEXT NOT NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending_hq_decision', 'pending_store_recount', 'pending_hq_review', 'closed')),
  diagnosis TEXT NOT NULL,
  assigned_to TEXT NOT NULL,
  created_at TEXT NOT NULL,
  closed_at TEXT,
  resolution TEXT,
  FOREIGN KEY (document_id) REFERENCES count_documents(id)
);

CREATE TABLE task_audit_events_next (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,
  detail TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES inventory_tasks_next(id)
);

INSERT INTO inventory_tasks_next (
  id, store_code, document_id, material_name, theoretical_qty, initial_qty, recheck_qty,
  unit, severity, status, diagnosis, assigned_to, created_at, closed_at, resolution
)
SELECT
  id, store_code, document_id, material_name, theoretical_qty, initial_qty, recheck_qty,
  unit, severity, status, diagnosis, assigned_to, created_at, closed_at, resolution
FROM inventory_tasks;

INSERT INTO task_audit_events_next (
  id, task_id, actor_role, action, detail, created_at
)
SELECT
  id, task_id, actor_role, action, detail, created_at
FROM task_audit_events;

DROP TABLE task_audit_events;
DROP TABLE inventory_tasks;

ALTER TABLE inventory_tasks_next RENAME TO inventory_tasks;
ALTER TABLE task_audit_events_next RENAME TO task_audit_events;

CREATE INDEX IF NOT EXISTS idx_inventory_tasks_store_status
ON inventory_tasks(store_code, status);

CREATE INDEX IF NOT EXISTS idx_task_audit_events_task_created
ON task_audit_events(task_id, created_at);
