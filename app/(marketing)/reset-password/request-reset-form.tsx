"use client";

import { useActionState } from "react";
import { requestPasswordReset, type AuthResult } from "@/app/actions/auth";

export function RequestResetForm({ initialError }: { initialError?: string }) {
  const [state, formAction, pending] = useActionState<
    (AuthResult & { sent?: boolean }) | null,
    FormData
  >(
    async (_prev, formData) => requestPasswordReset(formData),
    initialError ? { error: initialError } : null,
  );

  if (state?.sent) {
    return (
      <p className="mt-8 rounded-md bg-emerald-50 px-3 py-3 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
        Check your inbox for a reset link.
      </p>
    );
  }

  return (
    <form action={formAction} className="mt-8 space-y-4">
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

      {state?.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
      >
        {pending ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
