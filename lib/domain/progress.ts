import type {
  CalendarDay,
  CalendarItem,
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

export interface CompletionPlan {
  fillMinutes: number;
  checklistStepIds: string[];
}

export function planCompletion(
  targetMinutes: number,
  progressMinutes: number,
  checklist: Array<{ id: string; completed: boolean }>,
): CompletionPlan {
  return {
    fillMinutes: Math.max(0, targetMinutes - progressMinutes),
    checklistStepIds: checklist.filter((step) => !step.completed).map((step) => step.id),
  };
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
    const active = scheduled.filter((entry) => {
      const item = itemById.get(entry.itemId);
      return !!item && (!item.archivedAt || item.archivedAt.slice(0, 10) > date);
    });

    const directMinutes = new Map<string, number>();
    for (const entry of input.timeEntries.filter((candidate) => candidate.date === date)) {
      directMinutes.set(entry.itemId, (directMinutes.get(entry.itemId) ?? 0) + entry.minutes);
    }

    const calendarItems: CalendarItem[] = active.map((entry) => {
      const item = itemById.get(entry.itemId)!;
      const ownSteps = effectiveChecklist(item.checklist, date);
      const completedIds = new Set(
        input.checklistCompletions
          .filter((completion) => completion.date === date && completion.itemId === item.id)
          .map((completion) => completion.stepId),
      );
      const checklist = ownSteps.map((step) => ({ ...step, completed: completedIds.has(step.id) }));
      const ownMinutes = directMinutes.get(item.id) ?? 0;
      const manualEntries = input.timeEntries
        .filter((timeEntry) => timeEntry.date === date && timeEntry.itemId === item.id && timeEntry.source === "manual")
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const contributedMinutes = 0;
      const actualMinutes = ownMinutes + contributedMinutes;
      const completionPlan = planCompletion(entry.durationMinutes, actualMinutes, checklist);
      const completionAction = input.completionActions?.find(
        (action) => action.itemId === item.id && action.date === date && !action.undoneAt,
      );
      return {
        item,
        date,
        targetMinutes: entry.durationMinutes,
        remainingMinutes: completionPlan.fillMinutes,
        directMinutes: ownMinutes,
        contributedMinutes,
        ...progress(actualMinutes, entry.durationMinutes, checklist.every((step) => step.completed)),
        checklist,
        manualEntries,
        subtasks: [],
        ...(completionAction ? { completionActionId: completionAction.id } : {}),
        ...(completionAction ? { completionFilledMinutes: completionAction.filledMinutes } : {}),
      };
    });
    return {
      date,
      items: calendarItems.sort((a, b) => a.item.position - b.item.position),
    };
  });
}
