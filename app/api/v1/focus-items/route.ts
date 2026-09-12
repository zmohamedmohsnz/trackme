import { authenticate } from "@/lib/api/auth";
import { errorResponse, ok, parseJson } from "@/lib/api/http";
import { createFocusItem, listFocusItems, patchFocusItem } from "@/lib/api/repository";
import { focusItemCreateSchema, focusItemPatchSchema } from "@/lib/api/schemas";

export async function GET(request: Request) {
  try { const { supabase, user } = await authenticate(request); const url = new URL(request.url); return ok(await listFocusItems(supabase, user.id, url.searchParams.get("includeArchived") === "true")); }
  catch (error) { return errorResponse(error); }
}
export async function POST(request: Request) {
  try { const input = await parseJson(request, focusItemCreateSchema); const { supabase, user } = await authenticate(request); return ok(await createFocusItem(supabase, user.id, input), 201); }
  catch (error) { return errorResponse(error); }
}
export async function PATCH(request: Request) {
  try { const input = await parseJson(request, focusItemPatchSchema); const { supabase, user } = await authenticate(request); return ok(await patchFocusItem(supabase, user.id, input)); }
  catch (error) { return errorResponse(error); }
}
