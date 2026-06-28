/**
 * Authenticated home — the worlds list and switcher (step 5). Fetches the user's
 * worlds via the Supabase client (door 1; RLS returns only their own rows) and
 * hands them to the client list island for sorting, creation, rename, and delete.
 */
import { createClient } from "@/lib/supabase/server";
import { WorldsList, type World } from "./worlds-list";

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("worlds")
    .select("id, name, created_at, updated_at");

  const worlds = (data ?? []) as World[];

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-12">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Your worlds</h1>
        <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          A world is a collection of subjects; a subject is a collection of facts.
        </p>
      </div>
      <WorldsList worlds={worlds} />
    </main>
  );
}
