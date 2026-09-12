import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig, isSupabaseConfigured } from "@/lib/env";

const PUBLIC_SEGMENTS = new Set(["login", "signup", "forgot-password", "reset-password", "auth"]);

export async function refreshSession(request: NextRequest, response: NextResponse) {
  if (!isSupabaseConfigured) return response;
  const { url, publishableKey } = getSupabaseConfig();
  const supabase = createServerClient(
    url,
    publishableKey,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const segments = request.nextUrl.pathname.split("/").filter(Boolean);
  const locale = segments[0] === "ar" ? "ar" : "en";
  const page = segments[1];
  const isApi = segments[0] === "api";
  const isPublic = !page || PUBLIC_SEGMENTS.has(page);

  if (!data?.claims && !isPublic && !isApi) {
    return NextResponse.redirect(new URL(`/${locale}/login`, request.url));
  }

  return response;
}
