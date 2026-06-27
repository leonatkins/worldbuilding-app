CREATE TYPE "public"."field_type" AS ENUM('List', 'Link', 'Text', 'Number', 'Boolean', 'Select', 'MultiSelect', 'Date', 'Scale', 'Color');--> statement-breakpoint
CREATE TYPE "public"."relationship_origin" AS ENUM('fact', 'field');--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid DEFAULT auth.uid() NOT NULL,
	"world_id" uuid NOT NULL,
	"name" text NOT NULL,
	"icon" text,
	"position" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "facts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid DEFAULT auth.uid() NOT NULL,
	"subject_id" uuid NOT NULL,
	"body" text NOT NULL,
	"position" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "field_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid DEFAULT auth.uid() NOT NULL,
	"subject_id" uuid NOT NULL,
	"field_id" uuid NOT NULL,
	"scalar_value" jsonb,
	"linked_subject_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "field_values_subject_id_field_id_unique" UNIQUE("subject_id","field_id")
);
--> statement-breakpoint
CREATE TABLE "list_value_subjects" (
	"field_value_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"account_id" uuid DEFAULT auth.uid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "list_value_subjects_field_value_id_subject_id_pk" PRIMARY KEY("field_value_id","subject_id")
);
--> statement-breakpoint
CREATE TABLE "relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid DEFAULT auth.uid() NOT NULL,
	"from_subject_id" uuid NOT NULL,
	"to_subject_id" uuid NOT NULL,
	"origin" "relationship_origin" NOT NULL,
	"fact_id" uuid,
	"field_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "relationships_from_subject_id_to_subject_id_origin_fact_id_field_id_unique" UNIQUE("from_subject_id","to_subject_id","origin","fact_id","field_id")
);
--> statement-breakpoint
CREATE TABLE "schema_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid DEFAULT auth.uid() NOT NULL,
	"category_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" "field_type" NOT NULL,
	"position" double precision NOT NULL,
	"target_category_id" uuid,
	"select_options" text[],
	"scale_min" integer,
	"scale_max" integer,
	"unit" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid DEFAULT auth.uid() NOT NULL,
	"category_id" uuid NOT NULL,
	"world_id" uuid NOT NULL,
	"name" text NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "worlds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid DEFAULT auth.uid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facts" ADD CONSTRAINT "facts_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "facts" ADD CONSTRAINT "facts_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_values" ADD CONSTRAINT "field_values_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_values" ADD CONSTRAINT "field_values_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_values" ADD CONSTRAINT "field_values_field_id_schema_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."schema_fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_values" ADD CONSTRAINT "field_values_linked_subject_id_subjects_id_fk" FOREIGN KEY ("linked_subject_id") REFERENCES "public"."subjects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_value_subjects" ADD CONSTRAINT "list_value_subjects_field_value_id_field_values_id_fk" FOREIGN KEY ("field_value_id") REFERENCES "public"."field_values"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_value_subjects" ADD CONSTRAINT "list_value_subjects_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_value_subjects" ADD CONSTRAINT "list_value_subjects_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_from_subject_id_subjects_id_fk" FOREIGN KEY ("from_subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_to_subject_id_subjects_id_fk" FOREIGN KEY ("to_subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_fact_id_facts_id_fk" FOREIGN KEY ("fact_id") REFERENCES "public"."facts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_field_id_schema_fields_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."schema_fields"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schema_fields" ADD CONSTRAINT "schema_fields_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schema_fields" ADD CONSTRAINT "schema_fields_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schema_fields" ADD CONSTRAINT "schema_fields_target_category_id_categories_id_fk" FOREIGN KEY ("target_category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_world_id_worlds_id_fk" FOREIGN KEY ("world_id") REFERENCES "public"."worlds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "worlds" ADD CONSTRAINT "worlds_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Row-Level Security (hand-appended; drizzle-kit does not manage RLS). Every
-- table carries a denormalized account_id, so each policy is a flat one-liner:
-- a row is visible/writable only by its owner. auth.uid() is the requesting
-- user's id; the DEFAULT auth.uid() on account_id plus WITH CHECK makes the
-- owner un-spoofable on insert/update. See docs/step-4-data-model-spec.md §2.1.
ALTER TABLE "worlds" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "worlds: own rows" ON "worlds" FOR ALL USING ("account_id" = auth.uid()) WITH CHECK ("account_id" = auth.uid());--> statement-breakpoint
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "categories: own rows" ON "categories" FOR ALL USING ("account_id" = auth.uid()) WITH CHECK ("account_id" = auth.uid());--> statement-breakpoint
ALTER TABLE "schema_fields" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "schema_fields: own rows" ON "schema_fields" FOR ALL USING ("account_id" = auth.uid()) WITH CHECK ("account_id" = auth.uid());--> statement-breakpoint
ALTER TABLE "subjects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "subjects: own rows" ON "subjects" FOR ALL USING ("account_id" = auth.uid()) WITH CHECK ("account_id" = auth.uid());--> statement-breakpoint
ALTER TABLE "facts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "facts: own rows" ON "facts" FOR ALL USING ("account_id" = auth.uid()) WITH CHECK ("account_id" = auth.uid());--> statement-breakpoint
ALTER TABLE "field_values" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "field_values: own rows" ON "field_values" FOR ALL USING ("account_id" = auth.uid()) WITH CHECK ("account_id" = auth.uid());--> statement-breakpoint
ALTER TABLE "list_value_subjects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "list_value_subjects: own rows" ON "list_value_subjects" FOR ALL USING ("account_id" = auth.uid()) WITH CHECK ("account_id" = auth.uid());--> statement-breakpoint
ALTER TABLE "relationships" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "relationships: own rows" ON "relationships" FOR ALL USING ("account_id" = auth.uid()) WITH CHECK ("account_id" = auth.uid());