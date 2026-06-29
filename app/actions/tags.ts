"use server";

/**
 * Server-only tag actions (step 7). Tags are world-scoped and normalized, so a
 * rename propagates everywhere in one write. Apply reuses an existing tag
 * (case-insensitive match) or creates it, then links it to the subject. Door 1;
 * RLS-scoped; account_id auto-stamped. See docs/step-7-subject-crud-spec.md §5.3.
 */
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validateTagName, sameTag } from "@/lib/tags";

export type TagResult = { error?: string };

/** Apply a tag to a subject by name — reusing or creating the world tag. */
export async function applyTag(formData: FormData): Promise<TagResult> {
  const worldId = String(formData.get("worldId") ?? "");
  const subjectId = String(formData.get("subjectId") ?? "");
  const validated = validateTagName(String(formData.get("name") ?? ""));
  if ("error" in validated) return { error: validated.error };

  const supabase = await createClient();

  const { data: worldTags } = await supabase
    .from("tags")
    .select("id, name")
    .eq("world_id", worldId);

  let tagId = (worldTags ?? []).find((t) => sameTag(t.name, validated.name))?.id as
    | string
    | undefined;

  if (!tagId) {
    const { data: created, error } = await supabase
      .from("tags")
      .insert({ world_id: worldId, name: validated.name })
      .select("id")
      .single();
    if (error || !created) {
      // Possible race on the unique index — re-resolve before giving up.
      const { data: again } = await supabase
        .from("tags")
        .select("id, name")
        .eq("world_id", worldId);
      tagId = (again ?? []).find((t) => sameTag(t.name, validated.name))?.id as
        | string
        | undefined;
      if (!tagId) return { error: error?.message ?? "Could not create tag." };
    } else {
      tagId = created.id;
    }
  }

  const { error: linkError } = await supabase
    .from("subject_tags")
    .upsert(
      { subject_id: subjectId, tag_id: tagId },
      { onConflict: "subject_id,tag_id", ignoreDuplicates: true },
    );
  if (linkError) return { error: linkError.message };

  revalidatePath(`/worlds/${worldId}/subjects/${subjectId}`);
  return {};
}

export async function removeTag(formData: FormData): Promise<TagResult> {
  const worldId = String(formData.get("worldId") ?? "");
  const subjectId = String(formData.get("subjectId") ?? "");
  const tagId = String(formData.get("tagId") ?? "");

  const supabase = await createClient();
  const { error } = await supabase
    .from("subject_tags")
    .delete()
    .eq("subject_id", subjectId)
    .eq("tag_id", tagId);

  if (error) return { error: error.message };
  revalidatePath(`/worlds/${worldId}/subjects/${subjectId}`);
  return {};
}

/** Rename a world tag (propagates to every subject via the join). */
export async function renameTag(formData: FormData): Promise<TagResult> {
  const worldId = String(formData.get("worldId") ?? "");
  const tagId = String(formData.get("tagId") ?? "");
  const validated = validateTagName(String(formData.get("name") ?? ""));
  if ("error" in validated) return { error: validated.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("tags")
    .update({ name: validated.name })
    .eq("id", tagId);

  if (error) {
    // 23505 = unique violation against another tag with the same name.
    if (error.code === "23505") {
      return { error: `A “${validated.name}” tag already exists in this world.` };
    }
    return { error: error.message };
  }
  revalidatePath(`/worlds/${worldId}`, "layout");
  return {};
}

/** Delete a world tag entirely (cascade removes it from every subject). */
export async function deleteTag(formData: FormData): Promise<TagResult> {
  const worldId = String(formData.get("worldId") ?? "");
  const tagId = String(formData.get("tagId") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.from("tags").delete().eq("id", tagId);

  if (error) return { error: error.message };
  revalidatePath(`/worlds/${worldId}`, "layout");
  return {};
}
