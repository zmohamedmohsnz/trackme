export type IsoDate = `${number}-${number}-${number}`;

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type FocusItemKind = "area" | "subtask";

export interface ChecklistStep {
  id: string;
  itemId: string;
  label: string;
  position: number;
  effectiveFrom: IsoDate;
  effectiveTo?: IsoDate | null;
}

export interface FocusItem {
  id: string;
  kind: FocusItemKind;
  parentId?: string | null;
  name: string;
  position: number;
  archivedAt?: string | null;
  checklist: ChecklistStep[];
}

export interface WeeklyPlanEntry {
  itemId: string;
  weekday: Weekday;
  durationMinutes: number;
}

export interface WeeklyPlanVersion {
  id: string;
  effectiveFrom: IsoDate;
  effectiveTo?: IsoDate | null;
  entries: WeeklyPlanEntry[];
}

export type DateOverride = {
  date: IsoDate;
  itemId: string;
} & (
  | { operation: "skip" }
  | { operation: "add" | "resize"; durationMinutes: number }
);

export interface TimeEntry {
  id: string;
  itemId: string;
  date: IsoDate;
  minutes: number;
  source?: "manual" | "completion_fill";
}

export interface ChecklistCompletion {
  stepId: string;
  itemId: string;
  date: IsoDate;
}

export interface CalendarItem {
  item: FocusItem;
  date: IsoDate;
  targetMinutes: number;
  directMinutes: number;
  contributedMinutes: number;
  actualMinutes: number;
  percent: number;
  checklist: Array<ChecklistStep & { completed: boolean }>;
  complete: boolean;
  completionActionId?: string;
  completionFilledMinutes?: number;
}

export interface CalendarDay {
  date: IsoDate;
  items: CalendarItem[];
}

export interface UserSettings {
  locale: "en" | "ar";
  timezone: string;
  weekStartsOn: Weekday;
  onboardingStep: number;
  onboardingCompleted: boolean;
}

export interface CompletionAction {
  id: string;
  itemId: string;
  date: IsoDate;
  idempotencyKey: string;
  targetMinutes: number;
  progressMinutesBefore: number;
  filledMinutes: number;
  undoneAt?: string | null;
}
