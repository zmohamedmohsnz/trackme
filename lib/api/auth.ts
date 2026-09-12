import { createClient as createSupabaseClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { createClient as createCookieClient } from "@/lib/supabase/server";
import { ApiError } from "./http";

type ClientFactory = (request: Request, bearerToken?: string) => Promise<SupabaseClient>;

async function defaultFactory(_request: Request, bearerToken?: string): Promise<SupabaseClient> {
  if (!bearerToken) return createCookieClient();
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${bearerToken}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    },
  );
}

export async function authenticate(
  request: Request,
  factory: ClientFactory = defaultFactory,
): Promise<{ supabase: SupabaseClient; user: User }> {
  const authorization = request.headers.get("authorization");
  let bearerToken: string | undefined;
  if (authorization) {
    const match = /^Bearer\s+([^\s]+)$/i.exec(authorization);
    if (!match) throw new ApiError(401, "unauthorized", "Authorization must use a Bearer token.");
    bearerToken = match[1];
  }
  const supabase = await factory(request, bearerToken);
  const { data, error } = bearerToken
    ? await supabase.auth.getUser(bearerToken)
    : await supabase.auth.getUser();
  if (error || !data.user) throw new ApiError(401, "unauthorized", "Authentication is required.");
  return { supabase, user: data.user };
}
