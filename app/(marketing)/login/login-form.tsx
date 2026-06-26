"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signIn, signInWithGoogle, type AuthResult } from "@/app/actions/auth";

export function LoginForm({
  next,
  initialError,
}: {
  next?: string;
  initialError?: string;
}) {
  const [state, formAction, pending] = useActionState<AuthResult | null, FormData>(
    async (_prev, formData) => signIn(formData),
    initialError ? { error: initialError } : null,
  );

  return (
    <div className="mt-8 space-y-4">
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="next" value={next ?? "/"} />

        <label className="block space-y-1">
          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Email
          </span>
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-neutral-100"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Password
          </span>
          <input
            type="password"
            name="password"
            required
            autoComplete="current-password"
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-neutral-100"
          />
        </label>

        {state?.error && (
          <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div className="text-right">
        <Link
          href="/reset-password"
          className="text-sm text-neutral-500 underline-offset-4 hover:underline"
        >
          Forgot password?
        </Link>
      </div>

      <div className="flex items-center gap-3 text-xs text-neutral-400">
        <span className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
        or
        <span className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
      </div>

      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next ?? "/"} />
        <button
          type="submit"
          className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
        >
          Sign in with Google
        </button>
      </form>
    </div>
  );
}
