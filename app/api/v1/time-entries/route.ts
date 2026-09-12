import { authenticate } from "@/lib/api/auth";
import { errorResponse, ok, parseJson } from "@/lib/api/http";
import { createTimeEntry, deleteTimeEntry } from "@/lib/api/repository";
import { timeEntryCreateSchema, timeEntryDeleteSchema } from "@/lib/api/schemas";

export async function POST(request: Request) {
  try { const input = await parseJson(request, timeEntryCreateSchema); const { supabase, user } = await authenticate(request); return ok(await createTimeEntry(supabase, user.id, input), 201); }
  catch (error) { return errorResponse(error); }
}
export async function DELETE(request: Request) {
  try { const input = await parseJson(request, timeEntryDeleteSchema); const { supabase, user } = await authenticate(request); await deleteTimeEntry(supabase, user.id, input.id); return new Response(null, { status: 204 }); }
  catch (error) { return errorResponse(error); }
}
