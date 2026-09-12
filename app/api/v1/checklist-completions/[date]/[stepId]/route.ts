import {authenticate} from "@/lib/api/auth";
import {ApiError, errorResponse, ok} from "@/lib/api/http";
import {deleteChecklistCompletion, putChecklistCompletion} from "@/lib/api/repository";
import {isoDateSchema, uuidSchema} from "@/lib/api/schemas";
import type {IsoDate} from "@/types/domain";

type Context = {params: Promise<{date: string; stepId: string}>};

async function parameters(context: Context) {
  const params = await context.params;
  const date = isoDateSchema.safeParse(params.date);
  const stepId = uuidSchema.safeParse(params.stepId);
  if (!date.success || !stepId.success) throw new ApiError(400, "validation_error", "The path parameters are invalid.");
  return {date: date.data as IsoDate, stepId: stepId.data};
}

export async function PUT(request: Request, context: Context) {
  try {
    const [{date, stepId}, auth] = await Promise.all([parameters(context), authenticate(request)]);
    return ok(await putChecklistCompletion(auth.supabase, auth.user.id, date, stepId));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const [{date, stepId}, auth] = await Promise.all([parameters(context), authenticate(request)]);
    await deleteChecklistCompletion(auth.supabase, auth.user.id, date, stepId);
    return new Response(null, {status: 204});
  } catch (error) {
    return errorResponse(error);
  }
}
