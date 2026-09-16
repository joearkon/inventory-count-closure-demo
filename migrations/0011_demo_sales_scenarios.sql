CREATE TABLE IF NOT EXISTS demo_sales_runs (
  id TEXT PRIMARY KEY,
  business_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('active', 'reverted')),
  created_at TEXT NOT NULL,
  reverted_at TEXT
);

CREATE TABLE IF NOT EXISTS demo_sales_records (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  store_code TEXT NOT NULL,
  business_date TEXT NOT NULL,
  sku_code TEXT NOT NULL,
  product_name TEXT NOT NULL,
  sales_qty REAL NOT NULL,
  sales_amount REAL NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (run_id) REFERENCES demo_sales_runs(id)
);

CREATE INDEX IF NOT EXISTS idx_demo_sales_active_date
ON demo_sales_records(run_id, business_date, store_code);
