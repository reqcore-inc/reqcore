-- Custom per-job pipeline stages.
--
-- Replaces the fixed `application_status` / `rule_action` enums with a
-- per-job `pipeline_stage` table. This migration is data-preserving: it seeds
-- the six legacy stages for every existing job, backfills each application and
-- automation rule onto the matching stage, and only then drops the old columns.
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS "pgcrypto";--> statement-breakpoint
CREATE TYPE "public"."stage_category" AS ENUM('applied', 'in_progress', 'hired', 'rejected');--> statement-breakpoint
CREATE TABLE "pipeline_stage" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"job_id" text NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT 'slate' NOT NULL,
	"category" "stage_category" DEFAULT 'in_progress' NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_entry" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pipeline_stage" ADD CONSTRAINT "pipeline_stage_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_stage" ADD CONSTRAINT "pipeline_stage_job_id_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."job"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pipeline_stage_organization_id_idx" ON "pipeline_stage" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "pipeline_stage_job_id_idx" ON "pipeline_stage" USING btree ("job_id");--> statement-breakpoint

-- Seed the six legacy default stages for every existing job. Names map 1:1 to
-- the old `application_status` / `rule_action` slugs so the backfills below can
-- match on lower(name).
INSERT INTO "pipeline_stage" ("id", "organization_id", "job_id", "name", "color", "category", "display_order", "is_entry")
SELECT gen_random_uuid(), j."organization_id", j."id", t.name, t.color, t.category::"stage_category", t.ord, t.is_entry
FROM "job" j
CROSS JOIN (VALUES
	('New',       'blue',   'applied',     0, true),
	('Screening', 'violet', 'in_progress', 1, false),
	('Interview', 'amber',  'in_progress', 2, false),
	('Offer',     'teal',   'in_progress', 3, false),
	('Hired',     'green',  'hired',       4, false),
	('Rejected',  'slate',  'rejected',    5, false)
) AS t(name, color, category, ord, is_entry);
--> statement-breakpoint

-- Application → stage. Add nullable, backfill from the old enum, then enforce.
ALTER TABLE "application" ADD COLUMN "status_id" text;--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN "status_category" "stage_category" DEFAULT 'applied' NOT NULL;--> statement-breakpoint
UPDATE "application" a
SET "status_id" = s."id", "status_category" = s."category"
FROM "pipeline_stage" s
WHERE s."job_id" = a."job_id" AND lower(s."name") = a."status"::text;--> statement-breakpoint
ALTER TABLE "application" ALTER COLUMN "status_id" SET NOT NULL;--> statement-breakpoint

-- Automation rule → target stage. Old action slug matches the stage name.
ALTER TABLE "application_rule" ADD COLUMN "target_stage_id" text;--> statement-breakpoint
UPDATE "application_rule" r
SET "target_stage_id" = s."id"
FROM "pipeline_stage" s
WHERE s."job_id" = r."job_id" AND lower(s."name") = r."action"::text;--> statement-breakpoint
ALTER TABLE "application_rule" ALTER COLUMN "target_stage_id" SET NOT NULL;--> statement-breakpoint

ALTER TABLE "application" ADD CONSTRAINT "application_status_id_pipeline_stage_id_fk" FOREIGN KEY ("status_id") REFERENCES "public"."pipeline_stage"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_rule" ADD CONSTRAINT "application_rule_target_stage_id_pipeline_stage_id_fk" FOREIGN KEY ("target_stage_id") REFERENCES "public"."pipeline_stage"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "application_status_id_idx" ON "application" USING btree ("status_id");--> statement-breakpoint
CREATE INDEX "application_status_category_idx" ON "application" USING btree ("status_category");--> statement-breakpoint
ALTER TABLE "application" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "application_rule" DROP COLUMN "action";--> statement-breakpoint
DROP TYPE "public"."application_status";--> statement-breakpoint
DROP TYPE "public"."rule_action";
