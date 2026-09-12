import type {CalendarDay, FocusItem, IsoDate, UserSettings, WeeklyPlanVersion} from "@/types/domain";

export const demoFocusItems: FocusItem[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    kind: "area",
    name: "Deep work",
    position: 0,
    checklist: [
      {id: "00000000-0000-4000-8000-000000000011", itemId: "00000000-0000-4000-8000-000000000001", label: "Review priorities", position: 0, effectiveFrom: "2026-01-01"},
      {id: "00000000-0000-4000-8000-000000000012", itemId: "00000000-0000-4000-8000-000000000001", label: "Capture learnings", position: 1, effectiveFrom: "2026-01-01"},
    ],
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    kind: "subtask",
    parentId: "00000000-0000-4000-8000-000000000001",
    name: "Focused reading",
    position: 0,
    checklist: [
      {id: "00000000-0000-4000-8000-000000000013", itemId: "00000000-0000-4000-8000-000000000002", label: "Read one chapter", position: 0, effectiveFrom: "2026-01-01"},
    ],
  },
  {id: "00000000-0000-4000-8000-000000000003", kind: "area", name: "Old fitness plan", position: 1, archivedAt: "2026-08-01T00:00:00Z", checklist: []},
];

export const demoSettings: UserSettings = {
  locale: "en",
  timezone: "Africa/Cairo",
  weekStartsOn: 6,
  onboardingStep: 3,
  onboardingCompleted: true,
};

export const demoWeeklyPlan: WeeklyPlanVersion[] = [{
  id: "00000000-0000-4000-8000-000000000021",
  effectiveFrom: "2026-01-01",
  entries: [
    {itemId: demoFocusItems[0].id, weekday: 1, durationMinutes: 120},
    {itemId: demoFocusItems[0].id, weekday: 3, durationMinutes: 120},
    {itemId: demoFocusItems[0].id, weekday: 6, durationMinutes: 120},
    {itemId: demoFocusItems[1].id, weekday: 1, durationMinutes: 45},
    {itemId: demoFocusItems[1].id, weekday: 3, durationMinutes: 45},
    {itemId: demoFocusItems[1].id, weekday: 6, durationMinutes: 45},
  ],
}];

function study(date: IsoDate): CalendarDay {
  const area = demoFocusItems[0];
  const subtask = demoFocusItems[1];
  return {date, items: [
    {item: area, date, targetMinutes: 120, directMinutes: 35, contributedMinutes: 45, actualMinutes: 80, percent: 66.67, checklist: area.checklist.map((step,index)=>({...step,completed:index===0})), complete: false},
    {item: subtask, date, targetMinutes: 45, directMinutes: 45, contributedMinutes: 0, actualMinutes: 45, percent: 100, checklist: subtask.checklist.map(step=>({...step,completed:true})), complete: true},
  ]};
}

export function demoCalendar(from:string,to:string): CalendarDay[] {
  const days:CalendarDay[]=[]; const cursor=new Date(`${from}T12:00:00`); const end=new Date(`${to}T12:00:00`);
  while(cursor<=end){const iso=cursor.toISOString().slice(0,10) as IsoDate;days.push(cursor.getDay()===0?{date:iso,items:[]}:study(iso));cursor.setDate(cursor.getDate()+1)}
  return days;
}
