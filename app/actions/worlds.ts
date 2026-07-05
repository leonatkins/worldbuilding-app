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
import {
  applyWorldTemplate,
} from "@/app/actions/templates";
import {
  parseSnapshot,
} from "@/lib/templates/parse";
import { BUILTIN_TEMPLATES } from "@/lib/templates/builtins";

// Shape returned to client forms on failure. Success paths redirect/revalidate.
export type WorldResult = { error: string };

/**
 * Create a world and seed it per the chosen starting point (design §4.4):
 * - `default`  — seed the five `DEFAULT_CATEGORIES` (no schema fields).
 * - `blank`     — empty world, no categories.
 * - `template`  — apply a world-template snapshot (built-in or private),
 *                 unpacking categories + fields. Honors A3 stub creation.
 *
 * Because door 1 can't wrap multiple inserts in one transaction, we use
 * undo-on-failure: if seeding fails, the just-created world is deleted so no
 * half-seeded world remains (step-5 spec §4). Template apply carries its own
 * longer undo chain (fields → stubs → categories). On success, redirect into
 * the new world.
 */
export async function createWorld(formData: FormData): Promise<WorldResult> {
  const validated = validateName(String(formData.get("name") ?? ""));
  if ("error" in validated) return validated;

  const startingPoint = String(formData.get("startingPoint") ?? "default");
  const templateId = String(formData.get("templateId") ?? "");

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

  if (startingPoint === "blank") {
    revalidatePath("/");
    redirect(`/worlds/${world.id}`);
  }

  if (startingPoint === "template" && templateId) {
    const snapshot = await resolveTemplateSnapshot(supabase, templateId);
    if ("error" in snapshot) {
      await supabase.from("worlds").delete().eq("id", world.id);
      return { error: snapshot.error };
    }
    const result = await applyWorldTemplate(snapshot.value, world.id);
    if (result.error) {
      // applyWorldTemplate already undid its own inserts; drop the empty world.
      await supabase.from("worlds").delete().eq("id", world.id);
      return { error: result.error };
    }
    revalidatePath("/");
    redirect(`/worlds/${world.id}`);
  }

  // default: seed DEFAULT_CATEGORIES (no schema fields).
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

  revalidatePath("/");
  redirect(`/worlds/${world.id}`);
}

/** Resolve a template id (built-in `builtin:<key>` or a private DB uuid) to its snapshot. */
async function resolveTemplateSnapshot(
  supabase: Awaited<ReturnType<typeof createClient>>,
  templateId: string,
): Promise<{ value: import("@/lib/templates/types").Snapshot } | { error: string }> {
  if (templateId.startsWith("builtin:")) {
    const builtin = BUILTIN_TEMPLATES.find((t) => t.id === templateId);
    if (!builtin?.content) return { error: "Unknown built-in template." };
    return { value: builtin.content };
  }
  const { data } = await supabase
    .from("templates")
    .select("content")
    .eq("id", templateId)
    .maybeSingle();
  if (!data) return { error: "Template not found." };
  const parsed = parseSnapshot(data.content);
  if ("error" in parsed) return { error: parsed.error };
  return { value: parsed.value };
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

/**
 * Soft-delete a world (ADR 0005): stamps `deleted_at`, moving it to "Recently
 * Deleted" (restorable for 30 days, then a pg_cron job hard-deletes it, which
 * CASCADEs children). Children are NOT touched here — they simply become
 * unreachable while the world is hidden, so restore is lossless. RLS scopes to
 * owner.
 */
export async function deleteWorld(formData: FormData): Promise<WorldResult> {
  const worldId = String(formData.get("worldId") ?? "");

  const supabase = await createClient();
  const { error } = await supabase
    .from("worlds")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", worldId);

  if (error) return { error: error.message };

  revalidatePath("/");
  return { error: "" };
}

/** Restore a soft-deleted world from Recently Deleted (lossless — children intact). */
export async function restoreWorld(formData: FormData): Promise<WorldResult> {
  const worldId = String(formData.get("worldId") ?? "");

  const supabase = await createClient();
  const { error } = await supabase
    .from("worlds")
    .update({ deleted_at: null })
    .eq("id", worldId);

  if (error) return { error: error.message };

  revalidatePath("/");
  return { error: "" };
}

/**
 * Permanently delete a world now ("Delete now" in Recently Deleted). The real
 * hard delete; CASCADE (step 4) removes its categories/subjects/facts.
 */
export async function purgeWorld(formData: FormData): Promise<WorldResult> {
  const worldId = String(formData.get("worldId") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.from("worlds").delete().eq("id", worldId);

  if (error) return { error: error.message };

  revalidatePath("/");
  return { error: "" };
}
