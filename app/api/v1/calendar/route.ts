import { authenticate } from "@/lib/api/auth";
import { ApiError, errorResponse, ok } from "@/lib/api/http";
import { getCalendarRows } from "@/lib/api/repository";
import { isoDateSchema } from "@/lib/api/schemas";
import { buildCalendar } from "@/lib/domain/progress";
import type { DateOverride, FocusItem, IsoDate, WeeklyPlanVersion } from "@/types/domain";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url); const fromResult = isoDateSchema.safeParse(url.searchParams.get("from")); const toResult = isoDateSchema.safeParse(url.searchParams.get("to"));
    if (!fromResult.success || !toResult.success || fromResult.data > toResult.data) throw new ApiError(400, "validation_error", "A valid from/to date range is required.");
    const from = fromResult.data as IsoDate; const to = toResult.data as IsoDate;
    const { supabase, user } = await authenticate(request); const rows = await getCalendarRows(supabase, user.id, from, to);
    const items = (rows.items ?? []).map((row): FocusItem => ({ id: row.id, kind: row.kind, parentId: row.parent_id, name: row.name, position: row.position, archivedAt: row.archived_at, checklist: (row.checklist_templates ?? []).map((step) => ({ id: step.id, itemId: step.focus_item_id, label: step.label, position: step.position, effectiveFrom: step.effective_from, effectiveTo: step.effective_to })) }));
    const versions = (rows.versions ?? []).map((row): WeeklyPlanVersion => ({ id: row.id, effectiveFrom: row.effective_from, entries: (row.weekly_plan_entries ?? []).map((entry) => ({ itemId: entry.focus_item_id, weekday: entry.weekday, durationMinutes: entry.target_minutes })) }));
    const overrides = (rows.overrides ?? []).map((row): DateOverride => row.action === "skip" ? { date: row.local_date, itemId: row.focus_item_id, operation: "skip" } : { date: row.local_date, itemId: row.focus_item_id, operation: row.action, durationMinutes: row.target_minutes! });
    const checklistItemByStep = new Map(items.flatMap((item) => item.checklist.map((step) => [step.id, item.id] as const)));
    return ok(buildCalendar({ from, to, items, versions, overrides, timeEntries: (rows.timeEntries ?? []).map((row) => ({ id: row.id, itemId: row.focus_item_id, date: row.local_date, minutes: row.minutes, source: row.source })), checklistCompletions: (rows.completions ?? []).flatMap((row) => { const itemId = checklistItemByStep.get(row.checklist_template_id); return itemId ? [{ stepId: row.checklist_template_id, itemId, date: row.local_date }] : []; }) }));
  } catch (error) { return errorResponse(error); }
}
