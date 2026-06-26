/**
 * Auth callback. Supabase redirects here after Google OAuth, email
 * verification, and password-recovery links. We exchange the one-time code (or
 * token hash) for a session cookie, then forward the user on.
 *
 * Supported query shapes:
 *  - ?code=…            PKCE / OAuth (also used by SSR email links)
 *  - ?token_hash=…&type=…  older email-link format (verifyOtp)
 *  - ?next=/path        where to land afterwards (defaults to /)
 *  - ?error=…           provider denied / link expired → bounce to /login
 */
import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

function safeNext(next: string | null): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/";
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNext(searchParams.get("next"));

  const error = searchParams.get("error_description") ?? searchParams.get("error");
  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error)}`,
    );
  }

  const supabase = await createClient();

  const code = searchParams.get("code");
  if (code) {
    const { error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);
    if (!exchangeError) return NextResponse.redirect(`${origin}${next}`);
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(exchangeError.message)}`,
    );
  }

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  if (tokenHash && type) {
    const { error: otpError } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!otpError) return NextResponse.redirect(`${origin}${next}`);
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(otpError.message)}`,
    );
  }

  // No usable params — treat as an invalid link.
  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent("Invalid or expired link.")}`,
  );
}
