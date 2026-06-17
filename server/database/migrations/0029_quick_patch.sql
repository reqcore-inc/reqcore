-- Migration 0029: Add expiration_date column to document table for GDPR compliance
-- ──────────────────────────────────────────────────────────────────────────────

-- Add NOT NULL expiration_date column (timestamp)
ALTER TABLE "document" ADD COLUMN "expiration_date" timestamp NOT NULL;

-- Create index for efficient expiration-based queries
CREATE INDEX "document_expiration_date_idx" ON "document" USING btree ("expiration_date");