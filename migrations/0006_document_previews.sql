ALTER TABLE count_documents ADD COLUMN preview_data TEXT;
ALTER TABLE operation_tasks ADD COLUMN proof_document_id TEXT;

CREATE INDEX IF NOT EXISTS idx_operation_tasks_proof_document
ON operation_tasks(proof_document_id);
