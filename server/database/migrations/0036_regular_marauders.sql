CREATE TYPE "public"."screening_scenario_status" AS ENUM('completed', 'failed');--> statement-breakpoint
CREATE TABLE "screening_scenario" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"application_id" text NOT NULL,
	"status" "screening_scenario_status" DEFAULT 'completed' NOT NULL,
	"provider" text,
	"model" text,
	"billing_mode" "analysis_billing_mode" DEFAULT 'byok' NOT NULL,
	"config" jsonb,
	"input_snapshot" jsonb,
	"questions" jsonb,
	"prompt_tokens" integer,
	"completion_tokens" integer,
	"cost_usd_micros" integer,
	"error_message" text,
	"generated_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "screening_scenario" ADD CONSTRAINT "screening_scenario_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screening_scenario" ADD CONSTRAINT "screening_scenario_application_id_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."application"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screening_scenario" ADD CONSTRAINT "screening_scenario_generated_by_id_user_id_fk" FOREIGN KEY ("generated_by_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "screening_scenario_organization_id_idx" ON "screening_scenario" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "screening_scenario_application_id_idx" ON "screening_scenario" USING btree ("application_id");