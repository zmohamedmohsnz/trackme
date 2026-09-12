import { describe, expect, it } from "vitest";
import { buildCalendar, effectiveChecklist, progress } from "@/lib/domain/progress";
import type { FocusItem } from "@/types/domain";

const items: FocusItem[] = [
  { id: "area", kind: "area", name: "Health", position: 0, checklist: [{ id: "step", itemId: "area", label: "Stretch", position: 0, effectiveFrom: "2026-01-01" }] },
  { id: "child", kind: "subtask", parentId: "area", name: "Run", position: 0, checklist: [] },
];

describe("progress", () => {
  it("keeps over-target totals while capping percent", () => expect(progress(75, 60, true)).toEqual({ actualMinutes: 75, percent: 100, complete: true }));
  it("requires the item's own checklist", () => expect(progress(60, 60, false).complete).toBe(false));
  it("filters checklist templates by effective dates", () => expect(effectiveChecklist([{ id: "s", itemId: "i", label: "x", position: 0, effectiveFrom: "2026-02-01", effectiveTo: "2026-02-28" }], "2026-03-01")).toEqual([]));
  it("rolls immediate child time into an area and checks its own steps", () => {
    const [day] = buildCalendar({ from: "2026-02-09", to: "2026-02-09", items, versions: [{ id: "v", effectiveFrom: "2026-01-01", entries: [{ itemId: "area", weekday: 1, durationMinutes: 60 }, { itemId: "child", weekday: 1, durationMinutes: 30 }] }], overrides: [], timeEntries: [{ id: "t1", itemId: "area", date: "2026-02-09", minutes: 30 }, { id: "t2", itemId: "child", date: "2026-02-09", minutes: 45 }], checklistCompletions: [{ itemId: "area", stepId: "step", date: "2026-02-09" }] });
    expect(day.items[0]).toMatchObject({ actualMinutes: 75, percent: 100, complete: true });
  });
  it("suppresses children when a parent is skipped", () => {
    const [day] = buildCalendar({ from: "2026-02-09", to: "2026-02-09", items, versions: [{ id: "v", effectiveFrom: "2026-01-01", entries: [{ itemId: "area", weekday: 1, durationMinutes: 60 }, { itemId: "child", weekday: 1, durationMinutes: 30 }] }], overrides: [{ date: "2026-02-09", itemId: "area", operation: "skip" }], timeEntries: [], checklistCompletions: [] });
    expect(day.items).toEqual([]);
  });
});
