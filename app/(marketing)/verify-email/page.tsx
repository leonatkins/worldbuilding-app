/**
 * Shown after email/password sign-up and to any signed-in user whose email is
 * not yet confirmed (middleware bounces them here). Static message + a resend
 * control. No app access until the address is verified.
 */
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ResendButton } from "./resend-button";

export default async function VerifyEmailPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-6 dark:bg-neutral-950">
      <div className="w-full max-w-md text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Check your inbox</h1>
        <p className="mt-3 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          We sent a verification link
          {user?.email ? (
            <>
              {" "}
              to <span className="font-medium">{user.email}</span>
            </>
          ) : null}
          . Click it to activate your account — then sign in.
        </p>

        <div className="mt-8">
          <ResendButton email={user?.email ?? ""} />
        </div>

        <p className="mt-6 text-sm text-neutral-500">
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
