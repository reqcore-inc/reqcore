CREATE TABLE "screening_email_template" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "application" ADD COLUMN "screening_invitation_sent_at" timestamp;--> statement-breakpoint
ALTER TABLE "screening_email_template" ADD CONSTRAINT "screening_email_template_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screening_email_template" ADD CONSTRAINT "screening_email_template_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "screening_email_template_org_user_idx" ON "screening_email_template" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "screening_email_template_organization_id_idx" ON "screening_email_template" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "screening_email_template_user_id_idx" ON "screening_email_template" USING btree ("user_id");