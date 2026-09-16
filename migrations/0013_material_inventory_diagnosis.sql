CREATE TABLE IF NOT EXISTS material_inventory_policies (
  store_code TEXT NOT NULL,
  material_name TEXT NOT NULL,
  unit TEXT NOT NULL,
  safety_qty REAL NOT NULL DEFAULT 0 CHECK(safety_qty >= 0),
  owner TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (store_code, material_name)
);

INSERT OR IGNORE INTO material_inventory_policies (store_code, material_name, unit, safety_qty, owner, updated_at) VALUES
  ('STORE001', '牛奶', 'L', 60, '供应链 / 营运', '2026-09-16T00:00:00.000Z'),
  ('STORE001', '糖浆', 'kg', 20, '供应链 / 营运', '2026-09-16T00:00:00.000Z'),
  ('STORE001', '杯子', '个', 250, '供应链 / 营运', '2026-09-16T00:00:00.000Z'),
  ('STORE001', '茶叶', 'kg', 2, '供应链 / 营运', '2026-09-16T00:00:00.000Z');

CREATE TABLE IF NOT EXISTS material_inventory_anomalies (
  id TEXT PRIMARY KEY,
  store_code TEXT NOT NULL,
  business_date TEXT NOT NULL,
  material_name TEXT NOT NULL,
  unit TEXT NOT NULL,
  rule_code TEXT NOT NULL,
  severity TEXT NOT NULL,
  strategy TEXT NOT NULL,
  owner TEXT NOT NULL,
  status TEXT NOT NULL,
  theoretical_closing_qty REAL NOT NULL,
  safety_qty REAL,
  evidence TEXT NOT NULL,
  source_batch_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  closed_at TEXT,
  closure_reason TEXT,
  UNIQUE(store_code, business_date, material_name, rule_code)
);

CREATE INDEX IF NOT EXISTS idx_material_inventory_anomalies_active
ON material_inventory_anomalies(store_code, business_date, status, severity);
