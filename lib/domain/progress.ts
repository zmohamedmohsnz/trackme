import type {
  CalendarDay,
  CompletionAction,
  ChecklistCompletion,
  ChecklistStep,
  DateOverride,
  FocusItem,
  IsoDate,
  TimeEntry,
  WeeklyPlanVersion,
} from "@/types/domain";
import { eachIsoDate } from "./dates";
import { resolvePlanEntries } from "./schedule";

export function effectiveChecklist(steps: ChecklistStep[], date: IsoDate): ChecklistStep[] {
  return steps
    .filter((step) => step.effectiveFrom <= date && (!step.effectiveTo || step.effectiveTo >= date))
    .sort((a, b) => a.position - b.position);
}

export function progress(actualMinutes: number, targetMinutes: number, checklistComplete: boolean) {
  const percent = targetMinutes > 0 ? Math.min(100, (actualMinutes / targetMinutes) * 100) : 0;
  return { actualMinutes, percent, complete: actualMinutes >= targetMinutes && checklistComplete };
}

export interface CalendarInput {
  from: IsoDate;
  to: IsoDate;
  items: FocusItem[];
  versions: WeeklyPlanVersion[];
  overrides: DateOverride[];
  timeEntries: TimeEntry[];
  checklistCompletions: ChecklistCompletion[];
  completionActions?: CompletionAction[];
}

export function buildCalendar(input: CalendarInput): CalendarDay[] {
  const itemById = new Map(input.items.map((item) => [item.id, item]));
  return eachIsoDate(input.from, input.to).map((date) => {
    const scheduled = resolvePlanEntries(date, input.versions, input.overrides);
    const scheduledIds = new Set(scheduled.map((entry) => entry.itemId));
    const active = scheduled.filter((entry) => {
      const item = itemById.get(entry.itemId);
      if (!item || (item.archivedAt && item.archivedAt.slice(0, 10) <= date)) return false;
      return item.kind !== "subtask" || (!!item.parentId && scheduledIds.has(item.parentId));
    });

    const directMinutes = new Map<string, number>();
    for (const entry of input.timeEntries.filter((candidate) => candidate.date === date)) {
      directMinutes.set(entry.itemId, (directMinutes.get(entry.itemId) ?? 0) + entry.minutes);
    }

    return {
      date,
      items: active.map((entry) => {
        const item = itemById.get(entry.itemId)!;
        const ownSteps = effectiveChecklist(item.checklist, date);
        const completedIds = new Set(
          input.checklistCompletions
            .filter((completion) => completion.date === date && completion.itemId === item.id)
            .map((completion) => completion.stepId),
        );
        const checklist = ownSteps.map((step) => ({ ...step, completed: completedIds.has(step.id) }));
        const ownMinutes = directMinutes.get(item.id) ?? 0;
        let contributedMinutes = 0;
        if (item.kind === "area") {
          for (const child of input.items.filter((candidate) => candidate.parentId === item.id)) {
            contributedMinutes += directMinutes.get(child.id) ?? 0;
          }
        }
        const actualMinutes = ownMinutes + contributedMinutes;
        const completionAction = input.completionActions?.find(
          (action) => action.itemId === item.id && action.date === date && !action.undoneAt,
        );
        return {
          item,
          date,
          targetMinutes: entry.durationMinutes,
          directMinutes: ownMinutes,
          contributedMinutes,
          ...progress(actualMinutes, entry.durationMinutes, checklist.every((step) => step.completed)),
          checklist,
          ...(completionAction ? { completionActionId: completionAction.id } : {}),
          ...(completionAction ? { completionFilledMinutes: completionAction.filledMinutes } : {}),
        };
      }),
    };
  });
}
