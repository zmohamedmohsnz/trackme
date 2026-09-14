import { describe, expect, it } from "vitest";
import { focusItemCreateSchema, focusItemPatchSchema, onboardingFinalizeSchema, onboardingSaveSchema, settingsPatchSchema, timeEntryCreateSchema } from "@/lib/api/schemas";

describe("API validation", () => {
  it("enforces duration bounds and whole minutes", () => {
    expect(timeEntryCreateSchema.safeParse({ itemId: crypto.randomUUID(), date: "2026-01-01", minutes: 0 }).success).toBe(false);
    expect(timeEntryCreateSchema.safeParse({ itemId: crypto.randomUUID(), date: "2026-01-01", minutes: 1.5 }).success).toBe(false);
    expect(timeEntryCreateSchema.safeParse({ itemId: crypto.randomUUID(), date: "2026-01-01", minutes: 1440 }).success).toBe(true);
  });
  it("requires a parent for subtasks", () => expect(focusItemCreateSchema.safeParse({ kind: "subtask", name: "Run", checklist: [] }).success).toBe(false));
  it("rejects impossible dates and invalid IANA timezones", () => {
    expect(timeEntryCreateSchema.safeParse({itemId:crypto.randomUUID(),date:"2026-02-30",minutes:30}).success).toBe(false);
    expect(settingsPatchSchema.safeParse({timezone:"Mars/Olympus_Mons"}).success).toBe(false);
    expect(settingsPatchSchema.safeParse({timezone:"Africa/Cairo"}).success).toBe(true);
  });
  it("validates trimmed names without altering the stored value", () => {
    const result=focusItemCreateSchema.safeParse({kind:"area",name:"  Deep work  ",checklist:[]});
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
    const draft={language:"en",timezone:"Africa/Cairo",weekStart:6,items:[
      {clientId:"area-1",kind:"area",name:"",checklist:[""],weekdays:[1,3,6],target:"120"},
      {clientId:"subtask-1",kind:"subtask",parentClientId:"area-1",name:"",checklist:[""],weekdays:[1,3,6],target:"15"},
    ]};
    expect(onboardingSaveSchema.safeParse({step:1,draft}).success).toBe(true);
    expect(onboardingFinalizeSchema.safeParse({effectiveFrom:"2026-09-13",draft}).success).toBe(false);
    expect(onboardingSaveSchema.safeParse({step:1,draft:{...draft,timezone:""}}).success).toBe(true);
    expect(onboardingFinalizeSchema.safeParse({effectiveFrom:"2026-09-13",draft:{...draft,timezone:""}}).success).toBe(false);
    draft.items[0].name="Deep work";
    draft.items[1].name="Reading";
    expect(onboardingFinalizeSchema.safeParse({effectiveFrom:"2026-09-13",draft}).success).toBe(true);
  });
  it("rejects invalid onboarding relationships, duplicate client ids, and targets",()=>{
    const base={language:"ar",timezone:"Africa/Cairo",weekStart:6};
    expect(onboardingSaveSchema.safeParse({step:2,draft:{...base,items:[
      {clientId:"same",kind:"area",name:"Area",checklist:[],weekdays:[],target:"60"},
      {clientId:"same",kind:"subtask",parentClientId:"missing",name:"Child",checklist:[],weekdays:[],target:"15"},
    ]}}).success).toBe(false);
    expect(onboardingFinalizeSchema.safeParse({effectiveFrom:"2026-09-13",draft:{...base,items:[
      {clientId:"area",kind:"area",name:"Area",checklist:[],weekdays:[1],target:"0"},
    ]}}).success).toBe(false);
  });
});
