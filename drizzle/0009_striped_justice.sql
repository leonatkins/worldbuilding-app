CREATE TABLE "subject_views" (
	"account_id" uuid DEFAULT auth.uid() NOT NULL,
	"subject_id" uuid NOT NULL,
	"last_viewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subject_views_account_id_subject_id_pk" PRIMARY KEY("account_id","subject_id")
);
--> statement-breakpoint
ALTER TABLE "subject_views" ADD CONSTRAINT "subject_views_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subject_views" ADD CONSTRAINT "subject_views_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- RLS: own rows only (same pattern as 0001_data_model / 0007_templates). View
-- history is per-account; the owner reads and writes only their own rows.
ALTER TABLE "subject_views" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "subject_views: own rows" ON "subject_views" FOR ALL
	USING ("account_id" = auth.uid())
	WITH CHECK ("account_id" = auth.uid());