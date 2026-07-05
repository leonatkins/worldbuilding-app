"use server";

/**
 * Onboarding seen-stamp (step 14, B2/B4). Stamps `accounts.onboarding_seen_at`
 * when the guide panel is dismissed during its auto-open session (dismiss
 * button, outside-click, or Escape). Re-opening from the icon later never
 * touches the flag — it's already seen. Per-account: a new device for the same
 * user is not re-onboarded. Door 1; RLS is owner-scoped on accounts.
 */
import { createClient } from "@/lib/supabase/server";

export async function markOnboardingSeen(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("accounts")
    .update({ onboarding_seen_at: new Date().toISOString() })
    .eq("id", (await supabase.auth.getUser()).data.user?.id ?? "");
  if (error) return { error: error.message };
  return {};
}
