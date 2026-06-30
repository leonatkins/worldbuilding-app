ALTER TABLE "facts" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
-- Soft delete (ADR 0005) now extends to facts (ADR 0006 / step 8): a 4th
-- best-effort 30-day purge job, matching the worlds/categories/subjects jobs in
-- 0002. pg_cron may not be installed/permitted on every environment, so failure
-- is caught and skipped (auto-purge is a nicety; soft delete + manual "Delete
-- now" work without it). drizzle-kit does not manage cron, so this is hand-written.
DO $$
BEGIN
	CREATE EXTENSION IF NOT EXISTS pg_cron;
	PERFORM cron.schedule('purge-facts', '0 3 * * *',
		$cron$DELETE FROM public.facts WHERE deleted_at < now() - interval '30 days'$cron$);
EXCEPTION WHEN OTHERS THEN
	RAISE NOTICE 'Skipping pg_cron purge-facts setup (%). Add the 30-day purge job manually if desired.', SQLERRM;
END $$;