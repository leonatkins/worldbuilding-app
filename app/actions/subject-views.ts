"use server";

/**
 * View-history recording (step 15a, ADR 0012). Upserts the one `subject_views`
 * row for (account, subject), bumping `last_viewed_at` to now on each open. Best-
 * effort recency: fired from a mount effect on the subject page, never awaited by
 * the render, and failures are swallowed — a missed view must never break the
 * page. Door 1; RLS + the composite PK scope and dedup the write.
 */
import { createClient } from "@/lib/supabase/server";

export async function recordSubjectView(subjectId: string): Promise<void> {
  if (!subjectId) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("subject_views").upsert(
    { account_id: user.id, subject_id: subjectId, last_viewed_at: new Date().toISOString() },
    { onConflict: "account_id,subject_id" },
  );
}
