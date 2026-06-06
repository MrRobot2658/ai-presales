-- Add processing status for immediate background ingest (no manual review)
ALTER TYPE knowledge_asset_status ADD VALUE IF NOT EXISTS 'processing';
