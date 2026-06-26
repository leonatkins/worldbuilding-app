"use client";

import { useActionState } from "react";
import { signUp, signInWithGoogle, type AuthResult } from "@/app/actions/auth";

export function SignupForm({ initialError }: { initialError?: string }) {
  const [state, formAction, pending] = useActionState<AuthResult | null, FormData>(
    async (_prev, formData) => signUp(formData),
    initialError ? { error: initialError } : null,
  );

  return (
    <div className="mt-8 space-y-4">
      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value="/" />
        <button
          type="submit"
          className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm font-semibold text-neutral-800 transition hover:border-indigo-400 hover:bg-indigo-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
        >
          Sign up with Google
        </button>
      </form>

      <div className="flex items-center gap-3 text-xs text-neutral-400">
        <span className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
        or with email
        <span className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
      </div>

      <form action={formAction} className="space-y-4">
        <label className="block space-y-1">
          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Email
          </span>
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-indigo-400 dark:focus:ring-indigo-900"
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
            minLength={8}
            autoComplete="new-password"
            className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-indigo-400 dark:focus:ring-indigo-900"
          />
          <span className="text-xs text-neutral-400">At least 8 characters.</span>
        </label>

        {state?.error && (
          <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-indigo-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
        >
          {pending ? "Creating account…" : "Create account"}
        </button>
      </form>
    </div>
  );
}
