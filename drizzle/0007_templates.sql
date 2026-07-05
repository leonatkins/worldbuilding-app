CREATE TYPE "public"."template_kind" AS ENUM('schema', 'world');--> statement-breakpoint
CREATE TABLE "templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid DEFAULT auth.uid() NOT NULL,
	"name" text NOT NULL,
	"kind" "template_kind" NOT NULL,
	"content" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "templates" ADD CONSTRAINT "templates_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- RLS: own rows only (same pattern as 0001_data_model / 0004_tags). Built-in
-- official templates live in app code (lib/templates/builtins.ts), so this
-- table holds user-authored private templates only — no is_official flag.
ALTER TABLE "templates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "templates: own rows" ON "templates" FOR ALL
	USING ("account_id" = auth.uid())
	WITH CHECK ("account_id" = auth.uid());
