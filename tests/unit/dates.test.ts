import { describe, expect, it } from "vitest";
import { eachIsoDate, isIsoDate, startOfWeekDate, todayInTimeZone } from "@/lib/domain/dates";

describe("date helpers", () => {
  it("creates inclusive ranges across month boundaries", () => {
    expect(eachIsoDate("2026-01-30", "2026-02-02")).toEqual(["2026-01-30", "2026-01-31", "2026-02-01", "2026-02-02"]);
  });
  it("supports configurable week starts", () => {
    expect(startOfWeekDate("2026-09-12", 6)).toBe("2026-09-12");
    expect(startOfWeekDate("2026-09-12", 1)).toBe("2026-09-07");
  });
  it("rejects impossible calendar dates", () => {
    expect(isIsoDate("2026-02-29")).toBe(false);
    expect(isIsoDate("2028-02-29")).toBe(true);
  });
  it("derives the local date in the configured IANA timezone", () => {
    const now=new Date("2026-09-12T22:30:00Z");
    expect(todayInTimeZone("Africa/Cairo",now)).toBe("2026-09-13");
    expect(todayInTimeZone("America/New_York",now)).toBe("2026-09-12");
  });
});
