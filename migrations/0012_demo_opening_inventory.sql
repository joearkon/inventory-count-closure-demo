CREATE TABLE IF NOT EXISTS demo_opening_inventory_counts (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  store_code TEXT NOT NULL,
  counted_date TEXT NOT NULL,
  effective_business_date TEXT NOT NULL,
  material_name TEXT NOT NULL,
  unit TEXT NOT NULL,
  physical_qty REAL NOT NULL CHECK(physical_qty >= 0),
  created_at TEXT NOT NULL,
  FOREIGN KEY (run_id) REFERENCES demo_sales_runs(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_demo_opening_inventory_run_material
ON demo_opening_inventory_counts(run_id, material_name, unit);

CREATE INDEX IF NOT EXISTS idx_demo_opening_inventory_effective_date
ON demo_opening_inventory_counts(store_code, effective_business_date);
