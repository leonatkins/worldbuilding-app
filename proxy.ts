import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Runs on every request except Next internals, API routes, and static assets.
// Session refresh + auth gating live in updateSession (lib/supabase/middleware).
// (Next 16 renamed the `middleware` convention to `proxy`.)
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     *  - _next/static, _next/image (build output / image optimizer)
     *  - favicon.ico and common static image types
     *  - /api (server routes handle their own auth)
     */
    "/((?!_next/static|_next/image|api|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
