/**
 * Sign-up. Split-screen: an editorial brand panel on the left, the form on the
 * right. Intentionally distinct from the calm, centered /login layout — the two
 * pages should never feel like the same template.
 */
import Link from "next/link";
import { SignupForm } from "./signup-form";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <section className="relative hidden flex-col justify-between overflow-hidden bg-indigo-700 p-12 text-indigo-50 lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-indigo-500/40 blur-3xl"
        />
        <span className="text-sm font-semibold uppercase tracking-widest text-indigo-200">
          Worldbuilding
        </span>
        <blockquote className="max-w-md text-2xl font-medium leading-snug">
          “A world is a collection of subjects; a subject is a collection of
          facts.”
          <footer className="mt-4 text-sm font-normal text-indigo-200">
            Capture fast. Let structure earn its place.
          </footer>
        </blockquote>
        <span className="text-xs text-indigo-300">Free tier: up to 2 worlds.</span>
      </section>

      {/* Form panel */}
      <section className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <h1 className="text-3xl font-bold tracking-tight">Create your account</h1>
          <p className="mt-2 text-sm text-neutral-500">
            Start building in under a minute.
          </p>

          <SignupForm initialError={error} />

          <p className="mt-6 text-sm text-neutral-500">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-indigo-600 underline-offset-4 hover:underline dark:text-indigo-400"
            >
              Sign in
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
