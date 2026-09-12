import { authenticate } from "@/lib/api/auth";
import { errorResponse, ok, parseJson } from "@/lib/api/http";
import { completeItem } from "@/lib/api/repository";
import { completionActionSchema } from "@/lib/api/schemas";

export async function POST(request: Request) {
  try { const input = await parseJson(request, completionActionSchema); const { supabase } = await authenticate(request); return ok(await completeItem(supabase, input), 201); }
  catch (error) { return errorResponse(error); }
}
