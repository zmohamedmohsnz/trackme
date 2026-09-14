import { describe, expect, it } from "vitest";
import { buildCalendar, effectiveChecklist, planCompletion, progress } from "@/lib/domain/progress";
import type { FocusItem } from "@/types/domain";

const items: FocusItem[] = [
  { id: "area", kind: "area", name: "Health", position: 0, checklist: [{ id: "step", itemId: "area", label: "Stretch", position: 0, effectiveFrom: "2026-01-01" }] },
  { id: "child", kind: "subtask", parentId: "area", name: "Run", position: 0, checklist: [] },
];

describe("progress", () => {
  it("plans completion from only missing time and unchecked item steps", () => {
    expect(planCompletion(60, 25, [
      { id: "done", completed: true },
      { id: "missing", completed: false },
    ])).toEqual({ fillMinutes: 35, checklistStepIds: ["missing"] });
  });
  it("does not create negative completion time when progress is already over target", () => {
    expect(planCompletion(60, 75, [])).toEqual({ fillMinutes: 0, checklistStepIds: [] });
  });
  it("keeps over-target totals while capping percent", () => expect(progress(75, 60, true)).toEqual({ actualMinutes: 75, percent: 100, complete: true }));
  it("requires the item's own checklist", () => expect(progress(60, 60, false).complete).toBe(false));
  it("filters checklist templates by effective dates", () => expect(effectiveChecklist([{ id: "s", itemId: "i", label: "x", position: 0, effectiveFrom: "2026-02-01", effectiveTo: "2026-02-28" }], "2026-03-01")).toEqual([]));
  it("rolls immediate child time into an area and checks its own steps", () => {
    const [day] = buildCalendar({ from: "2026-02-09", to: "2026-02-09", items, versions: [{ id: "v", effectiveFrom: "2026-01-01", entries: [{ itemId: "area", weekday: 1, durationMinutes: 60 }, { itemId: "child", weekday: 1, durationMinutes: 30 }] }], overrides: [], timeEntries: [{ id: "t1", itemId: "area", date: "2026-02-09", minutes: 30, source: "manual", createdAt: "2026-02-09T08:00:00Z" }, { id: "t2", itemId: "child", date: "2026-02-09", minutes: 45, source: "manual", createdAt: "2026-02-09T09:00:00Z" }], checklistCompletions: [{ itemId: "area", stepId: "step", date: "2026-02-09" }] });
    expect(day.items[0]).toMatchObject({ actualMinutes: 75, remainingMinutes: 0, percent: 100, complete: true });
    expect(day.items[0].subtasks.map((item)=>item.item.id)).toEqual(["child"]);
  });
  it("exposes only manual entries for the matching item and date, newest first", () => {
    const [day] = buildCalendar({
      from: "2026-02-09",
      to: "2026-02-09",
      items,
      versions: [{ id: "v", effectiveFrom: "2026-01-01", entries: [{ itemId: "area", weekday: 1, durationMinutes: 60 }] }],
      overrides: [],
      timeEntries: [
        { id: "older", itemId: "area", date: "2026-02-09", minutes: 10, source: "manual", createdAt: "2026-02-09T08:00:00Z" },
        { id: "completion", itemId: "area", date: "2026-02-09", minutes: 20, source: "completion_fill", createdAt: "2026-02-09T10:00:00Z" },
        { id: "newer", itemId: "area", date: "2026-02-09", minutes: 15, source: "manual", createdAt: "2026-02-09T09:00:00Z" },
        { id: "other-item", itemId: "child", date: "2026-02-09", minutes: 30, source: "manual", createdAt: "2026-02-09T11:00:00Z" },
      ],
      checklistCompletions: [],
    });
    expect(day.items[0].manualEntries.map((entry) => entry.id)).toEqual(["newer", "older"]);
    expect(day.items[0].actualMinutes).toBe(75);
  });
  it("suppresses children when a parent is skipped", () => {
    const [day] = buildCalendar({ from: "2026-02-09", to: "2026-02-09", items, versions: [{ id: "v", effectiveFrom: "2026-01-01", entries: [{ itemId: "area", weekday: 1, durationMinutes: 60 }, { itemId: "child", weekday: 1, durationMinutes: 30 }] }], overrides: [{ date: "2026-02-09", itemId: "area", operation: "skip" }], timeEntries: [], checklistCompletions: [] });
    expect(day.items).toEqual([]);
  });
  it("suppresses a child after its parent is archived", () => {
    const archivedItems: FocusItem[] = [{...items[0],archivedAt:"2026-02-01T00:00:00Z"},items[1]];
    const [day] = buildCalendar({ from: "2026-02-09", to: "2026-02-09", items: archivedItems, versions: [{ id: "v", effectiveFrom: "2026-01-01", entries: [{ itemId: "area", weekday: 1, durationMinutes: 60 }, { itemId: "child", weekday: 1, durationMinutes: 30 }] }], overrides: [], timeEntries: [], checklistCompletions: [] });
    expect(day.items).toEqual([]);
  });
  it("exposes an active completion action and treats an undone action as absent", () => {
    const base = { from: "2026-02-09" as const, to: "2026-02-09" as const, items: [items[0]], versions: [{ id: "v", effectiveFrom: "2026-01-01" as const, entries: [{ itemId: "area", weekday: 1 as const, durationMinutes: 60 }] }], overrides: [], timeEntries: [], checklistCompletions: [] };
    const active = buildCalendar({ ...base, completionActions: [{ id: "action", itemId: "area", date: "2026-02-09", idempotencyKey: "key", targetMinutes: 60, progressMinutesBefore: 0, filledMinutes: 60 }] });
    const undone = buildCalendar({ ...base, completionActions: [{ id: "action", itemId: "area", date: "2026-02-09", idempotencyKey: "key", targetMinutes: 60, progressMinutesBefore: 0, filledMinutes: 60, undoneAt: "2026-02-09T12:00:00Z" }] });
    expect(active[0].items[0]).toMatchObject({ completionActionId: "action", completionFilledMinutes: 60 });
    expect(undone[0].items[0].completionActionId).toBeUndefined();
  });
  it("uses renamed item labels without rewriting tracked facts or historical checklist versions",()=>{
    const renamed:FocusItem={...items[0],name:"Wellbeing",checklist:[
      {...items[0].checklist[0],effectiveTo:"2026-02-14"},
      {id:"step-v2",itemId:"area",label:"Mobility",position:0,effectiveFrom:"2026-02-15"},
    ]};
    const days=buildCalendar({from:"2026-02-09",to:"2026-02-16",items:[renamed],versions:[{id:"v",effectiveFrom:"2026-01-01",entries:[{itemId:"area",weekday:1,durationMinutes:60}]}],overrides:[],timeEntries:[{id:"t",itemId:"area",date:"2026-02-09",minutes:25,source:"manual",createdAt:"2026-02-09T08:00:00Z"}],checklistCompletions:[{itemId:"area",stepId:"step",date:"2026-02-09"}]});
    expect(days[0].items[0]).toMatchObject({item:{name:"Wellbeing"},actualMinutes:25,checklist:[{label:"Stretch",completed:true}]});
    expect(days[7].items[0].checklist).toMatchObject([{label:"Mobility",completed:false}]);
  });
});
