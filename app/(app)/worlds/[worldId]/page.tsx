/**
 * A world's home (step 5 — minimal). Resolves the world by id via the Supabase
 * client; RLS means a world the user doesn't own (or a bad id) returns no row, so
 * we 404. Lists the seeded categories to confirm creation worked. The category /
 * subject surfaces are fleshed out in step 6+.
 */
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type WorldPageProps = {
  params: Promise<{ worldId: string }>;
};

type Category = {
  id: string;
  name: string;
  icon: string | null;
  position: number;
};

export default async function WorldPage({ params }: WorldPageProps) {
  const { worldId } = await params;
  const supabase = await createClient();

  const { data: world } = await supabase
    .from("worlds")
    .select("id, name")
    .eq("id", worldId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!world) notFound();

  const { data: categoryData } = await supabase
    .from("categories")
    .select("id, name, icon, position")
    .eq("world_id", worldId)
    .is("deleted_at", null)
    .order("position");

  const categories = (categoryData ?? []) as Category[];

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">{world.name}</h1>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-neutral-500">Categories</h2>
        {categories.length === 0 ? (
          <p className="text-sm text-neutral-500">No categories in this world.</p>
        ) : (
          <ul className="divide-y divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
            {categories.map((category) => (
              <li
                key={category.id}
                className="flex items-center gap-3 px-4 py-3 text-sm"
              >
                <span aria-hidden className="text-base">
                  {category.icon ?? "•"}
                </span>
                <span className="font-medium">{category.name}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
