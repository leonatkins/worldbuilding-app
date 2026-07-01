"use server";

/**
 * Server-only auth actions. Every write path runs through the SSR Supabase
 * client so the session cookie is read/written server-side and RLS sees the
 * authenticated user. The anon key is the only key in play — no service-role
 * key ever reaches here or the client.
 */
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Shape returned to client forms on failure. Success paths redirect instead.
export type AuthResult = { error: string };

// Absolute origin for building auth redirect/callback URLs. Prefers the request
// Origin header; falls back to the configured site URL for non-browser callers.
async function siteOrigin(): Promise<string> {
  const origin = (await headers()).get("origin");
  return origin ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

// Keep `next` to same-origin app paths only — never an external URL.
function safeNext(next: FormDataEntryValue | null): string {
  if (typeof next === "string" && next.startsWith("/") && !next.startsWith("//")) {
    return next;
  }
  return "/";
}

export async function signIn(formData: FormData): Promise<AuthResult> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { error: error.message };
  redirect(next);
}

export async function signUp(formData: FormData): Promise<AuthResult> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${await siteOrigin()}/auth/callback` },
  });

  if (error) return { error: error.message };
  redirect("/verify-email");
}

// OAuth (Google). Computes the provider URL server-side and redirects the
// browser to it; Supabase later returns to /auth/callback to exchange the code.
// Used directly as a <form action>, so it returns void — failures bounce back
// to /login with an error message rather than returning a result object.
export async function signInWithGoogle(formData: FormData): Promise<void> {
  const next = safeNext(formData.get("next"));

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${await siteOrigin()}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }
  if (data.url) redirect(data.url);
  redirect(`/login?error=${encodeURIComponent("Could not start Google sign-in.")}`);
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// Step 1 of password reset: email the recovery link. The link lands on
// /auth/callback, which exchanges the code and forwards to the update form.
export async function requestPasswordReset(
  formData: FormData,
): Promise<AuthResult & { sent?: boolean }> {
  const email = String(formData.get("email") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await siteOrigin()}/auth/callback?next=${encodeURIComponent(
      "/reset-password?step=update",
    )}`,
  });

  if (error) return { error: error.message, sent: false };
  return { error: "", sent: true };
}

// Step 2 of password reset: set the new password using the recovery session
// established by the callback.
export async function updatePassword(formData: FormData): Promise<AuthResult> {
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) return { error: error.message };

  // End the recovery session so the user must sign in with the new password —
  // a password change shouldn't leave them silently authenticated.
  await supabase.auth.signOut();
  redirect("/login?reset=success");
}

export async function resendVerification(
  formData: FormData,
): Promise<AuthResult & { sent?: boolean }> {
  const email = String(formData.get("email") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${await siteOrigin()}/auth/callback` },
  });

  if (error) return { error: error.message, sent: false };
  return { error: "", sent: true };
}
