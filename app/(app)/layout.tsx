/**
 * Layout for authenticated product surfaces. Middleware already gates these
 * routes, but we re-check here as defense in depth (and because layouts can be
 * reached via paths the matcher might not cover). Renders a thin app chrome
 * with a sign-out control around all child pages.
 */
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions/auth";
import { WorldSwitcher } from "./world-switcher";
import { GuidePanel } from "./_components/guide-panel";
import { ThemeToggle } from "./_components/theme-toggle";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!user.email_confirmed_at) redirect("/verify-email");

  // Worlds for the in-world quick switcher (recently-updated first) + the
  // onboarding seen-state, fetched in parallel (one round-trip each). RLS
  // scopes both to the signed-in user. The switcher hides itself outside a
  // world. Step 14: auto-open the guide when `onboarding_seen_at` is null.
  const [worldData, accountData] = await Promise.all([
    supabase
      .from("worlds")
      .select("id, name")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false }),
    supabase.from("accounts").select("onboarding_seen_at").maybeSingle(),
  ]);
  const worlds = worldData.data ?? [];
  const autoOpenGuide = !(accountData.data as { onboarding_seen_at: string | null } | null)
    ?.onboarding_seen_at;

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-neutral-200 px-6 py-3 dark:border-neutral-800">
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="text-sm font-semibold tracking-tight transition hover:opacity-70"
          >
            Worldbuilding
          </Link>
          <WorldSwitcher worlds={worlds} />
        </div>
        <div className="flex shrink-0 items-center gap-3 text-sm text-neutral-500">
          <ThemeToggle />
          <GuidePanel autoOpen={autoOpenGuide} />
          <span className="hidden sm:inline">{user.email}</span>
          <form action={signOut} className="shrink-0">
            <button
              type="submit"
              className="whitespace-nowrap rounded-md px-2 py-1 text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}
