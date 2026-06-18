-- 1. Add the column
ALTER TABLE "document" ADD COLUMN "expiration_date" TIMESTAMP;

-- 2. Update existing documents
UPDATE "document" SET "expiration_date" = "created_at" + INTERVAL '2 years';

-- 3. Make column NOT NULL
ALTER TABLE "document" ALTER COLUMN "expiration_date" SET NOT NULL;

-- 4. Add index
CREATE INDEX IF NOT EXISTS "document_expiration_date_idx" ON "document" USING btree ("expiration_date");

-- 5. Comment
COMMENT ON COLUMN "document"."expiration_date" IS 'Date d''expiration du document pour conformité RGPD (2 ans après création par défaut)';