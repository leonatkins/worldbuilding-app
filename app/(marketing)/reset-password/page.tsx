/**
 * Password reset, two phases on one route:
 *  - default            request a reset link by email
 *  - ?step=update       set a new password (reached via the emailed link, which
 *                       /auth/callback turns into a recovery session)
 */
import Link from "next/link";
import { RequestResetForm } from "./request-reset-form";
import { UpdatePasswordForm } from "./update-password-form";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; error?: string }>;
}) {
  const { step, error } = await searchParams;
  const updating = step === "update";

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-6 dark:bg-neutral-950">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight">
          {updating ? "Set a new password" : "Reset your password"}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          {updating
            ? "Choose a new password for your account."
            : "We'll email you a link to reset it."}
        </p>

        {updating ? (
          <UpdatePasswordForm initialError={error} />
        ) : (
          <RequestResetForm initialError={error} />
        )}

        <p className="mt-6 text-center text-sm text-neutral-500">
          <Link
            href="/login"
            className="font-medium text-neutral-900 underline-offset-4 hover:underline dark:text-neutral-100"
          >
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
