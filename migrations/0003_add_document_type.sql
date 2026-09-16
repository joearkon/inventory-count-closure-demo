ALTER TABLE count_documents
ADD COLUMN document_type TEXT NOT NULL DEFAULT 'inventory_count';
