CREATE TABLE IF NOT EXISTS feishu_import_batches (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'feishu_bitable',
  status TEXT NOT NULL CHECK(status IN ('running', 'completed', 'failed')),
  started_at TEXT NOT NULL,
  completed_at TEXT,
  scanned_records INTEGER NOT NULL DEFAULT 0,
  imported_records INTEGER NOT NULL DEFAULT 0,
  mapped_sales_records INTEGER NOT NULL DEFAULT 0,
  unmapped_sales_records INTEGER NOT NULL DEFAULT 0,
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS feishu_sales_records (
  feishu_record_id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  business_date TEXT NOT NULL,
  store_code TEXT NOT NULL,
  sku_code TEXT,
  product_name TEXT,
  sales_qty REAL NOT NULL,
  sales_amount REAL,
  verified INTEGER,
  confidence TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (batch_id) REFERENCES feishu_import_batches(id)
);

CREATE INDEX IF NOT EXISTS idx_feishu_sales_records_store_date
ON feishu_sales_records(store_code, business_date);

CREATE TABLE IF NOT EXISTS feishu_material_consumption_daily (
  store_code TEXT NOT NULL,
  business_date TEXT NOT NULL,
  material_name TEXT NOT NULL,
  unit TEXT NOT NULL,
  theoretical_qty REAL NOT NULL,
  source_sales_qty REAL NOT NULL DEFAULT 0,
  last_batch_id TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (store_code, business_date, material_name)
);

CREATE INDEX IF NOT EXISTS idx_feishu_material_consumption_batch
ON feishu_material_consumption_daily(last_batch_id);
