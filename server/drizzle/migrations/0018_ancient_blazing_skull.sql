CREATE TABLE "ai_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"model" text NOT NULL,
	"base_url" text,
	"api_key" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "provider_id" uuid;--> statement-breakpoint
ALTER TABLE "cron_agents" ADD COLUMN "provider_id" uuid;--> statement-breakpoint
ALTER TABLE "token_usage" ADD COLUMN "provider" text;--> statement-breakpoint
ALTER TABLE "token_usage" ADD COLUMN "model" text;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_provider_id_ai_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."ai_providers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cron_agents" ADD CONSTRAINT "cron_agents_provider_id_ai_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."ai_providers"("id") ON DELETE set null ON UPDATE no action;