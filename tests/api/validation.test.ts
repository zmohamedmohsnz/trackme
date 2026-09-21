import { describe, expect, it } from "vitest";
import { areaGoalUpsertSchema, focusItemCreateSchema, focusItemPatchSchema, onboardingFinalizeSchema, onboardingSaveSchema, settingsPatchSchema, timeEntryCreateSchema } from "@/lib/api/schemas";

describe("API validation", () => {
  it("enforces duration bounds and whole minutes", () => {
    expect(timeEntryCreateSchema.safeParse({ itemId: crypto.randomUUID(), date: "2026-01-01", minutes: 0 }).success).toBe(false);
    expect(timeEntryCreateSchema.safeParse({ itemId: crypto.randomUUID(), date: "2026-01-01", minutes: 1.5 }).success).toBe(false);
    expect(timeEntryCreateSchema.safeParse({ itemId: crypto.randomUUID(), date: "2026-01-01", minutes: 1440 }).success).toBe(true);
  });
  it("allows unassigned tasks and explicit unassignment", () => {
    expect(focusItemCreateSchema.safeParse({name:"Run",checklist:[]}).success).toBe(true);
    expect(focusItemPatchSchema.safeParse({id:crypto.randomUUID(),areaId:null}).success).toBe(true);
  });
  it("validates each goal period and positive whole minutes",()=>{
    for(const period of ["day","week","month","year"])expect(areaGoalUpsertSchema.safeParse({areaId:crypto.randomUUID(),period,targetMinutes:60}).success).toBe(true);
    expect(areaGoalUpsertSchema.safeParse({areaId:crypto.randomUUID(),period:"day",targetMinutes:0}).success).toBe(false);
    expect(areaGoalUpsertSchema.safeParse({areaId:crypto.randomUUID(),period:"week",targetMinutes:1.5}).success).toBe(false);
  });
  it("rejects impossible dates and invalid IANA timezones", () => {
    expect(timeEntryCreateSchema.safeParse({itemId:crypto.randomUUID(),date:"2026-02-30",minutes:30}).success).toBe(false);
    expect(settingsPatchSchema.safeParse({timezone:"Mars/Olympus_Mons"}).success).toBe(false);
    expect(settingsPatchSchema.safeParse({timezone:"Africa/Cairo"}).success).toBe(true);
  });
  it("validates trimmed names without altering the stored value", () => {
    const result=focusItemCreateSchema.safeParse({name:"  Deep work  ",checklist:[]});
    expect(result.success).toBe(true);
    if(result.success)expect(result.data.name).toBe("  Deep work  ");
  });
  it("accepts explicit effective-dated checklist operations",()=>{
    const id=crypto.randomUUID();
    expect(focusItemPatchSchema.safeParse({id,checklistOperations:[{operation:"add",label:"Review",position:0,effectiveFrom:"2026-09-13"}]}).success).toBe(true);
    expect(focusItemPatchSchema.safeParse({id,checklistOperations:[{operation:"revise",id:crypto.randomUUID(),label:"Plan",position:1,effectiveFrom:"2026-09-20"}]}).success).toBe(true);
    expect(focusItemPatchSchema.safeParse({id,checklistOperations:[{operation:"retire",id:crypto.randomUUID(),effectiveFrom:"2026-02-30"}]}).success).toBe(false);
  });
  it("accepts incomplete onboarding drafts but requires a complete final setup",()=>{
    const draft={language:"en",timezone:"Africa/Cairo",weekStart:6,areas:[],tasks:[
      {clientId:"task-1",name:"",checklist:[""],weekdays:[1,3,6],target:"15"},
    ]};
    expect(onboardingSaveSchema.safeParse({step:1,draft}).success).toBe(true);
    expect(onboardingFinalizeSchema.safeParse({effectiveFrom:"2026-09-13",draft}).success).toBe(false);
    expect(onboardingSaveSchema.safeParse({step:1,draft:{...draft,timezone:""}}).success).toBe(true);
    expect(onboardingFinalizeSchema.safeParse({effectiveFrom:"2026-09-13",draft:{...draft,timezone:""}}).success).toBe(false);
    draft.tasks[0].name="Reading";
    expect(onboardingFinalizeSchema.safeParse({effectiveFrom:"2026-09-13",draft}).success).toBe(true);
  });
  it("rejects invalid onboarding relationships, duplicate client ids, and targets",()=>{
    const base={language:"ar",timezone:"Africa/Cairo",weekStart:6};
    expect(onboardingSaveSchema.safeParse({step:2,draft:{...base,areas:[{clientId:"same",name:"Area"}],tasks:[
      {clientId:"same",areaClientId:"missing",name:"Child",checklist:[],weekdays:[],target:"15"},
    ]}}).success).toBe(false);
    expect(onboardingFinalizeSchema.safeParse({effectiveFrom:"2026-09-13",draft:{...base,areas:[],tasks:[
      {clientId:"task",name:"Task",checklist:[],weekdays:[1],target:"0"},
    ]}}).success).toBe(false);
  });
});
