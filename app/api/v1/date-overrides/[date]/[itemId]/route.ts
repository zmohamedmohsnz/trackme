import { authenticate } from "@/lib/api/auth";
import { ApiError, errorResponse, ok, parseJson } from "@/lib/api/http";
import { deleteOverride, putOverride } from "@/lib/api/repository";
import { dateOverrideSchema, isoDateSchema, uuidSchema } from "@/lib/api/schemas";
import type { IsoDate } from "@/types/domain";

type Context = { params: Promise<{ date: string; itemId: string }> };
async function parameters(context: Context) {
  const params = await context.params;
  const parsed = { date: isoDateSchema.safeParse(params.date), itemId: uuidSchema.safeParse(params.itemId) };
  if (!parsed.date.success || !parsed.itemId.success) throw new ApiError(400, "validation_error", "The path parameters are invalid.");
  return { date: parsed.date.data as IsoDate, itemId: parsed.itemId.data };
}
export async function PUT(request: Request, context: Context) {
  try { const [{ date, itemId }, body, auth] = await Promise.all([parameters(context), parseJson(request, dateOverrideSchema), authenticate(request)]); return ok(await putOverride(auth.supabase, auth.user.id, date, itemId, { date, itemId, ...body })); }
  catch (error) { return errorResponse(error); }
}
export async function DELETE(request: Request, context: Context) {
  try { const [{ date, itemId }, auth] = await Promise.all([parameters(context), authenticate(request)]); await deleteOverride(auth.supabase, auth.user.id, date, itemId); return new Response(null, { status: 204 }); }
  catch (error) { return errorResponse(error); }
}
