CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"tier" text DEFAULT 'free' NOT NULL
);
--> statement-breakpoint
-- Identity is owned by Supabase Auth (auth.users); accounts.id mirrors it.
-- ON DELETE CASCADE: deleting the auth user removes their account row.
-- drizzle-kit does not manage the auth schema, so this FK is declared here in
-- raw SQL rather than in lib/db/schema.ts.
ALTER TABLE "accounts"
	ADD CONSTRAINT "accounts_id_users_id_fk"
	FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
--> statement-breakpoint
-- Account bootstrap: every new auth user gets an accounts row atomically with
-- sign-up, so there is never a window where a user exists in Auth without an
-- account (design.md §5). SECURITY DEFINER lets the trigger insert past RLS.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
	INSERT INTO public.accounts (id) VALUES (NEW.id);
	RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER on_auth_user_created
	AFTER INSERT ON auth.users
	FOR EACH ROW EXECUTE FUNCTION handle_new_user();
--> statement-breakpoint
-- RLS: an account can see and touch only its own row. auth.uid() is the id of
-- the requesting user; the bootstrap trigger above runs as SECURITY DEFINER so
-- it is unaffected by this policy.
ALTER TABLE "accounts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "accounts: own row only"
	ON "accounts" FOR ALL
	USING ("id" = auth.uid())
	WITH CHECK ("id" = auth.uid());
