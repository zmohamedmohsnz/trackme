import {describe,expect,it} from "vitest";
import {toCompletionAction,toDateOverride,toFocusItem,toSettings,toTimeEntry,toWeeklyPlan} from "@/lib/api/repository";

describe("API serializers",()=>{
  it("converts database rows into the shared camelCase contract",()=>{
    expect(toSettings({locale:"en",timezone:"Africa/Cairo",week_starts_on:6,onboarding_step:2,onboarding_completed_at:null})).toEqual({locale:"en",timezone:"Africa/Cairo",weekStartsOn:6,onboardingStep:2,onboardingCompleted:false});
    expect(toFocusItem({id:"item",kind:"area",parent_id:null,name:"Software",position:0,archived_at:null,checklist_templates:[{id:"step",focus_item_id:"item",label:"Review",position:0,effective_from:"2026-09-12",effective_to:null}]})).toMatchObject({id:"item",name:"Software",checklist:[{itemId:"item",effectiveFrom:"2026-09-12"}]});
    expect(toWeeklyPlan({id:"plan",effective_from:"2026-09-12",effective_to:null,weekly_plan_entries:[{focus_item_id:"item",weekday:6,target_minutes:240}]})).toMatchObject({effectiveFrom:"2026-09-12",entries:[{itemId:"item",durationMinutes:240}]});
    expect(toDateOverride({focus_item_id:"item",local_date:"2026-09-13",action:"skip",target_minutes:null})).toEqual({itemId:"item",date:"2026-09-13",operation:"skip"});
    expect(toTimeEntry({id:"time",focus_item_id:"item",local_date:"2026-09-13",minutes:30,source:"manual"})).toEqual({id:"time",itemId:"item",date:"2026-09-13",minutes:30,source:"manual"});
    expect(toCompletionAction({id:"action",focus_item_id:"item",local_date:"2026-09-13",idempotency_key:"key",target_minutes:60,progress_minutes_before:20,filled_minutes:40,undone_at:null})).toMatchObject({id:"action",itemId:"item",filledMinutes:40});
  });
});
