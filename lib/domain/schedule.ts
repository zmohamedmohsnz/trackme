import type { DateOverride, IsoDate, WeeklyPlanEntry, WeeklyPlanVersion } from "@/types/domain";
import { weekdayOf } from "./dates";

export function latestPlanForDate(
  versions: WeeklyPlanVersion[],
  date: IsoDate,
): WeeklyPlanVersion | undefined {
  return versions
    .filter((version) => version.effectiveFrom <= date && (!version.effectiveTo || version.effectiveTo >= date))
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
}

export function resolvePlanEntries(
  date: IsoDate,
  versions: WeeklyPlanVersion[],
  overrides: DateOverride[],
): WeeklyPlanEntry[] {
  const weekday = weekdayOf(date);
  const entries = new Map(
    (latestPlanForDate(versions, date)?.entries ?? [])
      .filter((entry) => entry.weekday === weekday)
      .map((entry) => [entry.itemId, { ...entry }]),
  );

  for (const override of overrides.filter((candidate) => candidate.date === date)) {
    if (override.operation === "skip") entries.delete(override.itemId);
    else {
      entries.set(override.itemId, {
        itemId: override.itemId,
        weekday,
        durationMinutes: override.durationMinutes,
      });
    }
  }
  return [...entries.values()];
}
