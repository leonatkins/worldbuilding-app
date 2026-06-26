"use client";

import { useActionState } from "react";
import { resendVerification, type AuthResult } from "@/app/actions/auth";

export function ResendButton({ email }: { email: string }) {
  const [state, formAction, pending] = useActionState<
    (AuthResult & { sent?: boolean }) | null,
    FormData
  >(async (_prev, formData) => resendVerification(formData), null);

  return (
    <div className="space-y-2">
      <form action={formAction}>
        <input type="hidden" name="email" value={email} />
        <button
          type="submit"
          disabled={pending || !email}
          className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
        >
          {pending ? "Sending…" : "Resend verification email"}
        </button>
      </form>

      {state?.sent && (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">
          Sent — check your inbox.
        </p>
      )}
      {state?.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
    </div>
  );
}
