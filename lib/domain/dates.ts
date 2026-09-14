import { addDays, format, getDay, isAfter, isValid, parseISO, startOfDay } from "date-fns";
import type { IsoDate, Weekday } from "@/types/domain";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): value is IsoDate {
  if (!ISO_DATE.test(value)) return false;
  const parsed = parseISO(value);
  return isValid(parsed) && format(parsed, "yyyy-MM-dd") === value;
}

export function eachIsoDate(from: IsoDate, to: IsoDate): IsoDate[] {
  const start = startOfDay(parseISO(from));
  const end = startOfDay(parseISO(to));
  if (isAfter(start, end)) throw new RangeError("from must be on or before to");
  const dates: IsoDate[] = [];
  for (let current = start; !isAfter(current, end); current = addDays(current, 1)) {
    dates.push(format(current, "yyyy-MM-dd") as IsoDate);
  }
  return dates;
}

export function weekdayOf(date: IsoDate): Weekday {
  return getDay(parseISO(date)) as Weekday;
}

export function startOfWeekDate(date: IsoDate, weekStartsOn: Weekday): IsoDate {
  const parsed = parseISO(date);
  const delta = (getDay(parsed) - weekStartsOn + 7) % 7;
  return format(addDays(parsed, -delta), "yyyy-MM-dd") as IsoDate;
}

export function todayInTimeZone(timeZone: string, now = new Date()): IsoDate {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}` as IsoDate;
}
