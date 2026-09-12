import { authenticate } from "@/lib/api/auth";
import { errorResponse, ok, parseJson } from "@/lib/api/http";
import { getWeeklyPlan, putWeeklyPlan } from "@/lib/api/repository";
import { weeklyPlanSchema } from "@/lib/api/schemas";

export async function GET(request: Request) {
  try { const { supabase, user } = await authenticate(request); return ok(await getWeeklyPlan(supabase, user.id)); }
  catch (error) { return errorResponse(error); }
}
export async function PUT(request: Request) {
  try { const input = await parseJson(request, weeklyPlanSchema); const { supabase, user } = await authenticate(request); return ok(await putWeeklyPlan(supabase, user.id, input)); }
  catch (error) { return errorResponse(error); }
}
