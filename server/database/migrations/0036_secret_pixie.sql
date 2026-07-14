CREATE TYPE "public"."analysis_run_kind" AS ENUM('application_scoring', 'transcript_analysis');--> statement-breakpoint
CREATE TYPE "public"."transcript_analysis_recommendation" AS ENUM('advance', 'hold', 'do_not_advance', 'insufficient_evidence');--> statement-breakpoint
CREATE TYPE "public"."transcript_extraction_mode" AS ENUM('per_answer', 'section_level');--> statement-breakpoint
CREATE TYPE "public"."transcript_source_type" AS ENUM('upload', 'paste');--> statement-breakpoint
ALTER TYPE "public"."document_type" ADD VALUE 'transcript';--> statement-breakpoint
CREATE TABLE "screening_transcript" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"application_id" text NOT NULL,
	"interview_id" text,
	"source_type" "transcript_source_type" NOT NULL,
	"document_id" text,
	"raw_text" text,
	"truncated" boolean DEFAULT false NOT NULL,
	"created_by_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transcript_analysis" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"transcript_id" text NOT NULL,
	"application_id" text NOT NULL,
	"analysis_run_id" text NOT NULL,
	"status" "analysis_run_status" DEFAULT 'completed' NOT NULL,
	"answer_breakdown" jsonb,
	"section_scores" jsonb NOT NULL,
	"extraction_mode" "transcript_extraction_mode" NOT NULL,
	"recommendation" "transcript_analysis_recommendation" NOT NULL,
	"confidence" integer NOT NULL,
	"rationale" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analysis_run" ADD COLUMN "kind" "analysis_run_kind" DEFAULT 'application_scoring' NOT NULL;--> statement-breakpoint
ALTER TABLE "screening_transcript" ADD CONSTRAINT "screening_transcript_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screening_transcript" ADD CONSTRAINT "screening_transcript_application_id_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."application"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screening_transcript" ADD CONSTRAINT "screening_transcript_interview_id_interview_id_fk" FOREIGN KEY ("interview_id") REFERENCES "public"."interview"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screening_transcript" ADD CONSTRAINT "screening_transcript_document_id_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screening_transcript" ADD CONSTRAINT "screening_transcript_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcript_analysis" ADD CONSTRAINT "transcript_analysis_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcript_analysis" ADD CONSTRAINT "transcript_analysis_transcript_id_screening_transcript_id_fk" FOREIGN KEY ("transcript_id") REFERENCES "public"."screening_transcript"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcript_analysis" ADD CONSTRAINT "transcript_analysis_application_id_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."application"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcript_analysis" ADD CONSTRAINT "transcript_analysis_analysis_run_id_analysis_run_id_fk" FOREIGN KEY ("analysis_run_id") REFERENCES "public"."analysis_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "screening_transcript_organization_id_idx" ON "screening_transcript" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "screening_transcript_application_id_idx" ON "screening_transcript" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "screening_transcript_created_at_idx" ON "screening_transcript" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "transcript_analysis_organization_id_idx" ON "transcript_analysis" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "transcript_analysis_application_id_idx" ON "transcript_analysis" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "transcript_analysis_transcript_id_idx" ON "transcript_analysis" USING btree ("transcript_id");--> statement-breakpoint
CREATE INDEX "transcript_analysis_created_at_idx" ON "transcript_analysis" USING btree ("created_at");