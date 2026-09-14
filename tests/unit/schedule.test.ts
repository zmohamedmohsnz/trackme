import { describe, expect, it } from "vitest";
import { latestPlanForDate, resolvePlanEntries } from "@/lib/domain/schedule";
import type { WeeklyPlanVersion } from "@/types/domain";

const versions: WeeklyPlanVersion[] = [
  { id: "old", effectiveFrom: "2026-01-01", entries: [{ itemId: "a", weekday: 1, durationMinutes: 30 }] },
  { id: "new", effectiveFrom: "2026-02-01", entries: [{ itemId: "a", weekday: 1, durationMinutes: 60 }] },
];

describe("schedule resolution", () => {
  it("chooses the latest effective version", () => expect(latestPlanForDate(versions, "2026-02-09")?.id).toBe("new"));
  it("does not select an expired or future version", () => {
    expect(latestPlanForDate([{...versions[0],effectiveTo:"2026-01-31"}],"2026-02-09")).toBeUndefined();
    expect(latestPlanForDate(versions,"2025-12-31")).toBeUndefined();
  });
  it("applies add, resize and skip overrides", () => {
    expect(resolvePlanEntries("2026-02-09", versions, [
      { date: "2026-02-09", itemId: "a", operation: "resize", durationMinutes: 90 },
      { date: "2026-02-09", itemId: "b", operation: "add", durationMinutes: 20 },
    ])).toMatchObject([{ itemId: "a", durationMinutes: 90 }, { itemId: "b", durationMinutes: 20 }]);
    expect(resolvePlanEntries("2026-02-09", versions, [{ date: "2026-02-09", itemId: "a", operation: "skip" }])).toEqual([]);
  });
});
