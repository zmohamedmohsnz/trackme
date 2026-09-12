import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import type { DateOverride, IsoDate } from "@/types/domain";
import { ApiError } from "./http";
import type { completionActionSchema, focusItemCreateSchema, focusItemPatchSchema, timeEntryCreateSchema, weeklyPlanSchema } from "./schemas";

export interface ChecklistRow { id: string; focus_item_id: string; label: string; position: number; effective_from: IsoDate; effective_to: IsoDate | null }
export interface FocusItemRow { id: string; kind: "area" | "subtask"; parent_id: string | null; name: string; position: number; archived_at: string | null; checklist_templates: ChecklistRow[] }
export interface PlanEntryRow { focus_item_id: string; weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6; target_minutes: number }
export interface PlanVersionRow { id: string; effective_from: IsoDate; weekly_plan_entries: PlanEntryRow[] }
export interface OverrideRow { focus_item_id: string; local_date: IsoDate; action: "add" | "resize" | "skip"; target_minutes: number | null }
export interface TimeEntryRow { id: string; focus_item_id: string; local_date: IsoDate; minutes: number; source: "manual" | "completion_fill" }
export interface CompletionRow { checklist_template_id: string; local_date: IsoDate }

function throwDb(error: { message: string; code?: string } | null) {
  if (error) throw new ApiError(error.code === "PGRST116" ? 404 : 400, "database_error", error.message);
}

export async function getSettings(db: SupabaseClient, userId: string) {
  const { data, error } = await db.from("profiles").select("*").eq("user_id", userId).single();
  throwDb(error); return data;
}

export async function patchSettings(db: SupabaseClient, userId: string, input: Record<string, unknown>) {
  const row = {
    ...(input.locale !== undefined ? { locale: input.locale } : {}),
    ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
    ...(input.weekStartsOn !== undefined ? { week_starts_on: input.weekStartsOn } : {}),
    ...(input.onboardingCompleted !== undefined ? { onboarding_completed_at: input.onboardingCompleted ? new Date().toISOString() : null } : {}),
  };
  const { data, error } = await db.from("profiles").update(row).eq("user_id", userId).select("*").single();
  throwDb(error); return data;
}

export async function listFocusItems(db: SupabaseClient, userId: string, includeArchived = false) {
  let query = db.from("focus_items").select("*, checklist_templates(*)").eq("user_id", userId).order("position");
  if (!includeArchived) query = query.is("archived_at", null);
  const { data, error } = await query; throwDb(error); return data as FocusItemRow[] | null;
}

export async function createFocusItem(db: SupabaseClient, userId: string, input: z.infer<typeof focusItemCreateSchema>) {
  const { checklist, ...item } = input;
  const { data, error } = await db.from("focus_items").insert({ user_id: userId, kind: item.kind, parent_id: item.parentId ?? null, name: item.name, position: item.position }).select("*").single();
  throwDb(error);
  if (checklist.length) {
    const { error: checklistError } = await db.from("checklist_templates").insert(checklist.map((step) => ({ user_id: userId, focus_item_id: data.id, label: step.label, position: step.position, effective_from: step.effectiveFrom, effective_to: step.effectiveTo ?? null })));
    throwDb(checklistError);
  }
  return (await listFocusItems(db, userId, true))?.find((candidate) => candidate.id === data.id);
}

export async function patchFocusItem(db: SupabaseClient, userId: string, input: z.infer<typeof focusItemPatchSchema>) {
  const { id, checklist, archived, ...changes } = input;
  const row = { ...(changes.name !== undefined ? { name: changes.name } : {}), ...(changes.position !== undefined ? { position: changes.position } : {}), ...(archived !== undefined ? { archived_at: archived ? new Date().toISOString() : null } : {}) };
  if (Object.keys(row).length) { const { error } = await db.from("focus_items").update(row).eq("id", id).eq("user_id", userId); throwDb(error); }
  if (checklist) {
    for (const step of checklist) {
      if (step.id) { const { error } = await db.from("checklist_templates").update({ label: step.label, position: step.position, effective_from: step.effectiveFrom, effective_to: step.effectiveTo ?? null }).eq("id", step.id).eq("focus_item_id", id).eq("user_id", userId); throwDb(error); }
      else { const { error } = await db.from("checklist_templates").insert({ user_id: userId, focus_item_id: id, label: step.label, position: step.position, effective_from: step.effectiveFrom, effective_to: step.effectiveTo ?? null }); throwDb(error); }
    }
  }
  return (await listFocusItems(db, userId, true))?.find((candidate) => candidate.id === id);
}

export async function getWeeklyPlan(db: SupabaseClient, userId: string) {
  const { data, error } = await db.from("weekly_plan_versions").select("*, weekly_plan_entries(*)").eq("user_id", userId).order("effective_from", { ascending: false });
  throwDb(error); return data;
}

export async function putWeeklyPlan(db: SupabaseClient, userId: string, input: z.infer<typeof weeklyPlanSchema>) {
  const { data: version, error } = await db.from("weekly_plan_versions").upsert({ user_id: userId, effective_from: input.effectiveFrom }, { onConflict: "user_id,effective_from" }).select("*").single();
  throwDb(error);
  const { error: deleteError } = await db.from("weekly_plan_entries").delete().eq("weekly_plan_version_id", version.id).eq("user_id", userId); throwDb(deleteError);
  if (input.entries.length) { const { error: insertError } = await db.from("weekly_plan_entries").insert(input.entries.map((entry) => ({ user_id: userId, weekly_plan_version_id: version.id, focus_item_id: entry.itemId, weekday: entry.weekday, target_minutes: entry.durationMinutes }))); throwDb(insertError); }
  return getWeeklyPlan(db, userId);
}

export async function putOverride(db: SupabaseClient, userId: string, date: IsoDate, itemId: string, input: DateOverride) {
  const { data, error } = await db.from("date_overrides").upsert({ user_id: userId, local_date: date, focus_item_id: itemId, action: input.operation, target_minutes: input.operation === "skip" ? null : input.durationMinutes }, { onConflict: "user_id,focus_item_id,local_date" }).select("*").single(); throwDb(error); return data;
}

export async function deleteOverride(db: SupabaseClient, userId: string, date: IsoDate, itemId: string) { const { error } = await db.from("date_overrides").delete().eq("user_id", userId).eq("local_date", date).eq("focus_item_id", itemId); throwDb(error); }

export async function createTimeEntry(db: SupabaseClient, userId: string, input: z.infer<typeof timeEntryCreateSchema>) { const { data, error } = await db.from("time_entries").insert({ user_id: userId, focus_item_id: input.itemId, local_date: input.date, minutes: input.minutes, source: "manual" }).select("*").single(); throwDb(error); return data; }
export async function deleteTimeEntry(db: SupabaseClient, userId: string, id: string) { const { error } = await db.from("time_entries").delete().eq("user_id", userId).eq("id", id); throwDb(error); }
export async function completeItem(db: SupabaseClient, input: z.infer<typeof completionActionSchema>) { const { data, error } = await db.rpc("complete_item", { p_item_id: input.itemId, p_local_date: input.date, p_idempotency_key: input.idempotencyKey }); throwDb(error); return data; }
export async function undoCompletion(db: SupabaseClient, id: string) { const { data, error } = await db.rpc("undo_completion", { p_action_id: id }); throwDb(error); return data; }

export async function getCalendarRows(db: SupabaseClient, userId: string, from: IsoDate, to: IsoDate) {
  const [items, versions, overrides, timeEntries, completions] = await Promise.all([
    db.from("focus_items").select("*, checklist_templates(*)").eq("user_id", userId),
    db.from("weekly_plan_versions").select("*, weekly_plan_entries(*)").eq("user_id", userId).lte("effective_from", to),
    db.from("date_overrides").select("*").eq("user_id", userId).gte("local_date", from).lte("local_date", to),
    db.from("time_entries").select("*").eq("user_id", userId).gte("local_date", from).lte("local_date", to),
    db.from("daily_checklist_completions").select("*").eq("user_id", userId).gte("local_date", from).lte("local_date", to),
  ]);
  for (const result of [items, versions, overrides, timeEntries, completions]) throwDb(result.error);
  return { items: items.data as FocusItemRow[] | null, versions: versions.data as PlanVersionRow[] | null, overrides: overrides.data as OverrideRow[] | null, timeEntries: timeEntries.data as TimeEntryRow[] | null, completions: completions.data as CompletionRow[] | null };
}
