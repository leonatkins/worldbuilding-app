ALTER TABLE "categories" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subjects" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "worlds" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
-- Soft delete (ADR 0005): hard-purge rows that have sat in "Recently Deleted" for
-- 30+ days. pg_cron may not be installed/permitted on every environment, so this
-- is best-effort: any failure is caught and skipped (auto-purge is a nicety —
-- soft delete and the manual "Delete now" action work without it). drizzle-kit
-- does not manage extensions or cron, so this is hand-written.
DO $$
BEGIN
	CREATE EXTENSION IF NOT EXISTS pg_cron;
	PERFORM cron.schedule('purge-worlds', '0 3 * * *',
		$cron$DELETE FROM public.worlds WHERE deleted_at < now() - interval '30 days'$cron$);
	PERFORM cron.schedule('purge-categories', '0 3 * * *',
		$cron$DELETE FROM public.categories WHERE deleted_at < now() - interval '30 days'$cron$);
	PERFORM cron.schedule('purge-subjects', '0 3 * * *',
		$cron$DELETE FROM public.subjects WHERE deleted_at < now() - interval '30 days'$cron$);
EXCEPTION WHEN OTHERS THEN
	RAISE NOTICE 'Skipping pg_cron purge setup (%). Add 30-day purge jobs manually if desired.', SQLERRM;
END $$;