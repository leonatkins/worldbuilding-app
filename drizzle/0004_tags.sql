CREATE TABLE "subject_tags" (
	"subject_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"account_id" uuid DEFAULT auth.uid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subject_tags_subject_id_tag_id_pk" PRIMARY KEY("subject_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid DEFAULT auth.uid() NOT NULL,
	"world_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "subject_tags" ADD CONSTRAINT "subject_tags_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subject_tags" ADD CONSTRAINT "subject_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subject_tags" ADD CONSTRAINT "subject_tags_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Tag names are unique per world, case-insensitively (step-7 spec §3). drizzle
-- cannot express a lower(name) expression index in the schema, so it is added by
-- hand here, alongside RLS (which drizzle also does not manage).
CREATE UNIQUE INDEX "tags_world_id_lower_name_unique"
	ON "tags" ("world_id", lower("name"));--> statement-breakpoint
-- RLS: own rows only (same pattern as 0001_data_model). account_id is auto-stamped
-- by DEFAULT auth.uid(); the policy pins each row to its owner on read and write.
ALTER TABLE "tags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tags: own rows" ON "tags" FOR ALL
	USING ("account_id" = auth.uid())
	WITH CHECK ("account_id" = auth.uid());--> statement-breakpoint
ALTER TABLE "subject_tags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "subject_tags: own rows" ON "subject_tags" FOR ALL
	USING ("account_id" = auth.uid())
	WITH CHECK ("account_id" = auth.uid());