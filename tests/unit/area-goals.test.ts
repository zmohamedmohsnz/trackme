import {describe,expect,it} from "vitest";
import {areaGoalProgress,goalPeriodBounds} from "@/lib/domain/area-goals";

describe("area goal periods",()=>{
  it("uses the configured week start",()=>expect(goalPeriodBounds("2026-09-21","week",6)).toEqual({periodStart:"2026-09-19",periodEnd:"2026-09-25"}));
  it("handles leap-year month and year boundaries",()=>{expect(goalPeriodBounds("2028-02-29","month",1)).toEqual({periodStart:"2028-02-01",periodEnd:"2028-02-29"});expect(goalPeriodBounds("2028-02-29","year",1)).toEqual({periodStart:"2028-01-01",periodEnd:"2028-12-31"})});
  it("keeps actual minutes while capping percentage",()=>expect(areaGoalProgress(90,60)).toEqual({actualMinutes:90,percent:100}));
});
