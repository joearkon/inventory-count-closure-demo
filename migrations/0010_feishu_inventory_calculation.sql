CREATE TABLE IF NOT EXISTS feishu_product_catalog (
  sku_code TEXT PRIMARY KEY,
  product_name TEXT NOT NULL,
  aliases TEXT,
  source_record_id TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS feishu_bom_lines (
  source_record_id TEXT PRIMARY KEY,
  sku_code TEXT NOT NULL,
  material_name TEXT NOT NULL,
  unit TEXT NOT NULL,
  usage_per_sale REAL NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_feishu_bom_lines_sku ON feishu_bom_lines(sku_code);

CREATE TABLE IF NOT EXISTS feishu_inventory_source_daily (
  store_code TEXT NOT NULL,
  business_date TEXT NOT NULL,
  material_name TEXT NOT NULL,
  unit TEXT NOT NULL,
  opening_qty REAL,
  receipt_qty REAL NOT NULL DEFAULT 0,
  scrap_qty REAL NOT NULL DEFAULT 0,
  transfer_in_qty REAL NOT NULL DEFAULT 0,
  transfer_out_qty REAL NOT NULL DEFAULT 0,
  source_closing_qty REAL,
  source_record_id TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (store_code, business_date, material_name)
);

CREATE TABLE IF NOT EXISTS derived_inventory_ledger_daily (
  store_code TEXT NOT NULL,
  business_date TEXT NOT NULL,
  material_name TEXT NOT NULL,
  unit TEXT NOT NULL,
  opening_qty REAL NOT NULL DEFAULT 0,
  receipt_qty REAL NOT NULL DEFAULT 0,
  transfer_in_qty REAL NOT NULL DEFAULT 0,
  transfer_out_qty REAL NOT NULL DEFAULT 0,
  scrap_qty REAL NOT NULL DEFAULT 0,
  bom_consumption_qty REAL NOT NULL DEFAULT 0,
  theoretical_closing_qty REAL NOT NULL,
  source_closing_qty REAL,
  reconciliation_delta REAL,
  last_batch_id TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (store_code, business_date, material_name)
);

CREATE INDEX IF NOT EXISTS idx_derived_inventory_store_date
ON derived_inventory_ledger_daily(store_code, business_date);
