import { authenticate } from "@/lib/api/auth";
import { ApiError, errorResponse, ok } from "@/lib/api/http";
import { getCalendarRows, toCompletionAction, toDateOverride, toFocusItem, toTimeEntry, toWeeklyPlan } from "@/lib/api/repository";
import { isoDateSchema } from "@/lib/api/schemas";
import { buildCalendar } from "@/lib/domain/progress";
import type { IsoDate } from "@/types/domain";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url); const fromResult = isoDateSchema.safeParse(url.searchParams.get("from")); const toResult = isoDateSchema.safeParse(url.searchParams.get("to"));
    if (!fromResult.success || !toResult.success || fromResult.data > toResult.data) throw new ApiError(400, "validation_error", "A valid from/to date range is required.");
    const from = fromResult.data as IsoDate; const to = toResult.data as IsoDate;
    const { supabase, user } = await authenticate(request); const rows = await getCalendarRows(supabase, user.id, from, to);
    const items = (rows.items ?? []).map(toFocusItem);
    const versions = (rows.versions ?? []).map(toWeeklyPlan);
    const overrides = (rows.overrides ?? []).map(toDateOverride);
    const checklistItemByStep = new Map(items.flatMap((item) => item.checklist.map((step) => [step.id, item.id] as const)));
    return ok(buildCalendar({ from, to, items, versions, overrides, timeEntries: (rows.timeEntries ?? []).map(toTimeEntry), checklistCompletions: (rows.completions ?? []).flatMap((row) => { const itemId = checklistItemByStep.get(row.checklist_template_id); return itemId ? [{ stepId: row.checklist_template_id, itemId, date: row.local_date }] : []; }), completionActions: (rows.completionActions ?? []).map(toCompletionAction) }));
  } catch (error) { return errorResponse(error); }
}
