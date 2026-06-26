/**
 * Sign-in. Minimal, single-column, centered — deliberately calm and sparse.
 * Sign-up (/signup) uses a contrasting split-screen layout by design.
 */
import Link from "next/link";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; reset?: string }>;
}) {
  const { next, error, reset } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-6 dark:bg-neutral-950">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-2xl font-semibold tracking-tight">
          Welcome back
        </h1>
        <p className="mt-1 text-center text-sm text-neutral-500">
          Sign in to your worlds.
        </p>

        {reset === "success" && (
          <p className="mt-6 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            Password updated — sign in with your new password.
          </p>
        )}

        <LoginForm next={next} initialError={error} />

        <p className="mt-6 text-center text-sm text-neutral-500">
          New here?{" "}
          <Link
            href="/signup"
            className="font-medium text-neutral-900 underline-offset-4 hover:underline dark:text-neutral-100"
          >
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}
