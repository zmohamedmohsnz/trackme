import { describe, expect, it } from "vitest";
import { eachIsoDate, startOfWeekDate } from "@/lib/domain/dates";

describe("date helpers", () => {
  it("creates inclusive ranges across month boundaries", () => {
    expect(eachIsoDate("2026-01-30", "2026-02-02")).toEqual(["2026-01-30", "2026-01-31", "2026-02-01", "2026-02-02"]);
  });
  it("supports configurable week starts", () => {
    expect(startOfWeekDate("2026-09-12", 6)).toBe("2026-09-12");
    expect(startOfWeekDate("2026-09-12", 1)).toBe("2026-09-07");
  });
});
