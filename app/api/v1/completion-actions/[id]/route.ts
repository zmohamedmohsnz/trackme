import { authenticate } from "@/lib/api/auth";
import { ApiError, errorResponse, ok } from "@/lib/api/http";
import { undoCompletion } from "@/lib/api/repository";
import { uuidSchema } from "@/lib/api/schemas";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try { const { id } = await context.params; if (!uuidSchema.safeParse(id).success) throw new ApiError(400, "validation_error", "The completion action id is invalid."); const { supabase } = await authenticate(request); return ok(await undoCompletion(supabase, id)); }
  catch (error) { return errorResponse(error); }
}
