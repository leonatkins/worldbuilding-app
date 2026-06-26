/**
 * Session refresh + route protection, run from the root middleware on every
 * matched request.
 *
 * Two jobs (both required by @supabase/ssr):
 *  1. Refresh the Supabase auth cookie so server components always see a fresh
 *     session. This must read AND write cookies on the same response object.
 *  2. Gate access: unauthenticated users are bounced to /login?next=…, and
 *     authenticated-but-unverified users are bounced to /verify-email.
 *
 * IMPORTANT (per Supabase SSR guidance): do not run logic between creating the
 * client and calling getUser(), and always return the `supabaseResponse` object
 * as-is (only copying cookies onto any redirect) — otherwise the refreshed
 * session cookie can be dropped, randomly logging users out.
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Routes reachable without a session. Everything else requires auth.
const PUBLIC_ROUTES = [
  "/login",
  "/signup",
  "/reset-password",
  "/verify-email",
  "/auth/callback",
];

function isPublic(pathname: string): boolean {
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          supabaseResponse = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Refreshes the session and returns the authenticated user (or null).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;
  const onPublicRoute = isPublic(pathname);

  // No session → send to login, preserving where they were headed.
  if (!user && !onPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", `${pathname}${search}`);
    return copyCookies(supabaseResponse, NextResponse.redirect(url));
  }

  // Signed in but email not confirmed → block the app until verified.
  if (user && !user.email_confirmed_at && !onPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/verify-email";
    url.search = "";
    return copyCookies(supabaseResponse, NextResponse.redirect(url));
  }

  // Already authenticated and verified → keep them out of the auth pages.
  if (
    user &&
    user.email_confirmed_at &&
    (pathname === "/login" || pathname === "/signup")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return copyCookies(supabaseResponse, NextResponse.redirect(url));
  }

  return supabaseResponse;
}

// Carry the refreshed auth cookies from the supabase response onto a redirect,
// so the session is never lost when we bounce the request elsewhere.
function copyCookies(from: NextResponse, to: NextResponse): NextResponse {
  for (const cookie of from.cookies.getAll()) {
    to.cookies.set(cookie);
  }
  return to;
}
