"use client";

import { useActionState } from "react";
import { updatePassword, type AuthResult } from "@/app/actions/auth";

export function UpdatePasswordForm({ initialError }: { initialError?: string }) {
  const [state, formAction, pending] = useActionState<AuthResult | null, FormData>(
    async (_prev, formData) => updatePassword(formData),
    initialError ? { error: initialError } : null,
  );

  return (
    <form action={formAction} className="mt-8 space-y-4">
      <label className="block space-y-1">
        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          New password
        </span>
        <input
          type="password"
          name="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:focus:border-neutral-100"
        />
        <span className="text-xs text-neutral-400">At least 8 characters.</span>
      </label>

      {state?.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
      >
        {pending ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
