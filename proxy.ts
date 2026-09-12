import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";
import { refreshSession } from "@/lib/supabase/proxy";

const intlMiddleware = createMiddleware(routing);

export async function proxy(request: NextRequest) {
  const response = request.nextUrl.pathname.startsWith("/api/")
    ? NextResponse.next()
    : intlMiddleware(request);
  return refreshSession(request, response);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
