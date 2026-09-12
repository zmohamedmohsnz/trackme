import { authenticate } from "@/lib/api/auth";
import { errorResponse, ok, parseJson } from "@/lib/api/http";
import { getSettings, patchSettings } from "@/lib/api/repository";
import { settingsPatchSchema } from "@/lib/api/schemas";

export async function GET(request: Request) {
  try { const { supabase, user } = await authenticate(request); return ok(await getSettings(supabase, user.id)); }
  catch (error) { return errorResponse(error); }
}
export async function PATCH(request: Request) {
  try { const input = await parseJson(request, settingsPatchSchema); const { supabase, user } = await authenticate(request); return ok(await patchSettings(supabase, user.id, input)); }
  catch (error) { return errorResponse(error); }
}
