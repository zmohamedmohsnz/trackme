import type {GoalPeriod, IsoDate, Weekday} from "@/types/domain";

function iso(date: Date): IsoDate { return date.toISOString().slice(0, 10) as IsoDate; }
function utc(date: IsoDate): Date { return new Date(`${date}T12:00:00Z`); }

export function goalPeriodBounds(today: IsoDate, period: GoalPeriod, weekStartsOn: Weekday) {
  const start = utc(today);
  const end = utc(today);
  if (period === "week") {
    const offset = (start.getUTCDay() - weekStartsOn + 7) % 7;
    start.setUTCDate(start.getUTCDate() - offset);
    end.setTime(start.getTime()); end.setUTCDate(end.getUTCDate() + 6);
  } else if (period === "month") {
    start.setUTCDate(1); end.setUTCMonth(end.getUTCMonth() + 1, 0);
  } else if (period === "year") {
    start.setUTCMonth(0, 1); end.setUTCMonth(11, 31);
  }
  return {periodStart: iso(start), periodEnd: iso(end)};
}

export function areaGoalProgress(actualMinutes: number, targetMinutes: number) {
  return {actualMinutes, percent: targetMinutes > 0 ? Math.min(100, actualMinutes / targetMinutes * 100) : 0};
}
