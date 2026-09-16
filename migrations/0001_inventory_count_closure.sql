CREATE TABLE IF NOT EXISTS count_documents (
  id TEXT PRIMARY KEY,
  store_code TEXT NOT NULL,
  stage TEXT NOT NULL CHECK(stage IN ('initial', 'recheck')),
  original_filename TEXT NOT NULL,
  ocr_status TEXT NOT NULL,
  ocr_confidence REAL,
  note TEXT,
  received_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS count_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id TEXT NOT NULL,
  material_name TEXT NOT NULL,
  material_code TEXT,
  theoretical_qty REAL NOT NULL,
  actual_qty REAL NOT NULL,
  unit TEXT NOT NULL,
  match_status TEXT NOT NULL,
  ocr_confidence REAL,
  FOREIGN KEY (document_id) REFERENCES count_documents(id)
);

CREATE TABLE IF NOT EXISTS inventory_tasks (
  id TEXT PRIMARY KEY,
  store_code TEXT NOT NULL,
  document_id TEXT NOT NULL,
  material_name TEXT NOT NULL,
  theoretical_qty REAL NOT NULL,
  initial_qty REAL NOT NULL,
  recheck_qty REAL,
  unit TEXT NOT NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending_store_recount', 'pending_hq_review', 'closed')),
  diagnosis TEXT NOT NULL,
  assigned_to TEXT NOT NULL,
  created_at TEXT NOT NULL,
  closed_at TEXT,
  resolution TEXT,
  FOREIGN KEY (document_id) REFERENCES count_documents(id)
);

CREATE TABLE IF NOT EXISTS task_audit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,
  detail TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES inventory_tasks(id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_tasks_store_status
ON inventory_tasks(store_code, status);

CREATE INDEX IF NOT EXISTS idx_task_audit_events_task_created
ON task_audit_events(task_id, created_at DESC);
