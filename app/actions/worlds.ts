"use server";

/**
 * Server-only world CRUD. All data access goes through the Supabase client
 * ("door 1") so the request carries the user's JWT: `account_id` is auto-stamped
 * by the `DEFAULT auth.uid()` from step 4, and RLS enforces ownership on every
 * read/update/delete — app code never sets `account_id` or filters by owner.
 * See ADR 0004 (data access via Supabase client) and docs/step-5-world-crud-spec.md.
 *
 * Drizzle is NOT used here; it remains the schema/migration blueprint only.
 */
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_CATEGORIES, validateName } from "@/lib/worlds";

// Shape returned to client forms on failure. Success paths redirect/revalidate.
export type WorldResult = { error: string };

/**
 * Create a world and seed its default categories. Because door 1 can't wrap two
 * inserts in one transaction, we use undo-on-failure: if seeding the categories
 * fails, the just-created world is deleted so no half-seeded world remains
 * (step-5 spec §4). On success, redirect into the new world.
 */
export async function createWorld(formData: FormData): Promise<WorldResult> {
  const validated = validateName(String(formData.get("name") ?? ""));
  if ("error" in validated) return validated;

  const supabase = await createClient();
  // Defense in depth — RLS is the real guard, but confirm a session exists.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // account_id is auto-stamped by DEFAULT auth.uid(); we never set it.
  const { data: world, error: worldError } = await supabase
    .from("worlds")
    .insert({ name: validated.name })
    .select("id")
    .single();

  if (worldError || !world) {
    return { error: worldError?.message ?? "Could not create world." };
  }

  const { error: seedError } = await supabase.from("categories").insert(
    DEFAULT_CATEGORIES.map((c) => ({
      world_id: world.id,
      name: c.name,
      icon: c.icon,
      position: c.position,
    })),
  );

  if (seedError) {
    // Undo: drop the world so we never leave a half-seeded one behind.
    await supabase.from("worlds").delete().eq("id", world.id);
    return { error: seedError.message };
  }

  redirect(`/worlds/${world.id}`);
}

/** Rename a world. RLS scopes the update to the owner. */
export async function renameWorld(formData: FormData): Promise<WorldResult> {
  const worldId = String(formData.get("worldId") ?? "");
  const validated = validateName(String(formData.get("name") ?? ""));
  if ("error" in validated) return validated;

  const supabase = await createClient();
  // updated_at is app-managed (no DB trigger) — set it explicitly on update.
  const { error } = await supabase
    .from("worlds")
    .update({ name: validated.name, updated_at: new Date().toISOString() })
    .eq("id", worldId);

  if (error) return { error: error.message };

  revalidatePath("/");
  revalidatePath(`/worlds/${worldId}`);
  return { error: "" };
}

/** Delete a world. CASCADE (step 4) removes its categories/subjects/facts. */
export async function deleteWorld(formData: FormData): Promise<WorldResult> {
  const worldId = String(formData.get("worldId") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.from("worlds").delete().eq("id", worldId);

  if (error) return { error: error.message };

  revalidatePath("/");
  return { error: "" };
}
