import {createClient} from "@supabase/supabase-js";
import {afterAll,beforeAll,describe,expect,it} from "vitest";
import {GET as getCalendar} from "@/app/api/v1/calendar/route";
import {POST as focusPost,GET as focusGet,PATCH as focusPatch} from "@/app/api/v1/focus-items/route";
import {GET as settingsGet,PATCH as settingsPatch} from "@/app/api/v1/me/settings/route";
import {GET as planGet,PUT as planPut} from "@/app/api/v1/weekly-plan/route";
import {POST as timePost,DELETE as timeDelete} from "@/app/api/v1/time-entries/route";
import {POST as completionPost} from "@/app/api/v1/completion-actions/route";
import {DELETE as completionDelete} from "@/app/api/v1/completion-actions/[id]/route";
import {PUT as checklistPut,DELETE as checklistDelete} from "@/app/api/v1/checklist-completions/[date]/[stepId]/route";
import {PUT as overridePut,DELETE as overrideDelete} from "@/app/api/v1/date-overrides/[date]/[itemId]/route";
import {GET as onboardingGet,PATCH as onboardingPatch,POST as onboardingPost} from "@/app/api/v1/onboarding/route";

const enabled=process.env.RUN_INTEGRATION_TESTS==="1";
const suite=enabled?describe:describe.skip;

suite("live Supabase API",()=>{
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const publicKey=process.env[["PUBLISHABLE","KEY"].join("_")]!;
  const serviceKey=process.env[["SERVICE","ROLE","KEY"].join("_")]!;
  const password="TrackMe-test-123!";
  const emails=[`trackme-one-${crypto.randomUUID()}@example.test`,`trackme-two-${crypto.randomUUID()}@example.test`,`trackme-onboarding-${crypto.randomUUID()}@example.test`];
  const userIds:string[]=[];
  let tokens:string[]=[];
  let itemId="";
  let otherItemId="";
  let stepId="";
  let actionId="";

  beforeAll(async()=>{
    if(!url||!publicKey||!serviceKey)throw new Error(`Missing integration environment: url=${!!url}, publicKey=${!!publicKey}, serviceKey=${!!serviceKey}`);
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=publicKey;
    const admin=createClient(url,serviceKey,{auth:{persistSession:false}});
    for(const email of emails){const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true});if(error)throw error;userIds.push(data.user.id)}
    tokens=await Promise.all(emails.map(async email=>{const client=createClient(url,publicKey,{auth:{persistSession:false}});const {data,error}=await client.auth.signInWithPassword({email,password});if(error)throw error;return data.session!.access_token}));
  });

  afterAll(async()=>{if(!serviceKey)return;const admin=createClient(url,serviceKey,{auth:{persistSession:false}});await Promise.all(userIds.map(id=>admin.auth.admin.deleteUser(id)))});

  it("rejects unauthenticated access for every API method",async()=>{
    const id=crypto.randomUUID();
    const unauthenticated=[
      ()=>settingsGet(request("http://local/api/v1/me/settings","invalid-token")),
      ()=>settingsPatch(request("http://local/api/v1/me/settings","invalid-token","PATCH",{locale:"en"})),
      ()=>focusGet(request("http://local/api/v1/focus-items","invalid-token")),
      ()=>focusPost(request("http://local/api/v1/focus-items","invalid-token","POST",{kind:"area",name:"Private",position:0,checklist:[]})),
      ()=>focusPatch(request("http://local/api/v1/focus-items","invalid-token","PATCH",{id,name:"Private"})),
      ()=>planGet(request("http://local/api/v1/weekly-plan","invalid-token")),
      ()=>planPut(request("http://local/api/v1/weekly-plan","invalid-token","PUT",{effectiveFrom:"2026-09-13",entries:[]})),
      ()=>getCalendar(request("http://local/api/v1/calendar?from=2026-09-13&to=2026-09-13","invalid-token")),
      ()=>timePost(request("http://local/api/v1/time-entries","invalid-token","POST",{itemId:id,date:"2026-09-13",minutes:1})),
      ()=>timeDelete(request("http://local/api/v1/time-entries","invalid-token","DELETE",{id})),
      ()=>overridePut(request("http://local","invalid-token","PUT",{operation:"skip"}),{params:Promise.resolve({date:"2026-09-13",itemId:id})}),
      ()=>overrideDelete(request("http://local","invalid-token","DELETE"),{params:Promise.resolve({date:"2026-09-13",itemId:id})}),
      ()=>checklistPut(request("http://local","invalid-token","PUT"),{params:Promise.resolve({date:"2026-09-13",stepId:id})}),
      ()=>checklistDelete(request("http://local","invalid-token","DELETE"),{params:Promise.resolve({date:"2026-09-13",stepId:id})}),
      ()=>completionPost(request("http://local/api/v1/completion-actions","invalid-token","POST",{itemId:id,date:"2026-09-13",idempotencyKey:"unauthenticated"})),
      ()=>completionDelete(request("http://local","invalid-token","DELETE"),{params:Promise.resolve({id})}),
      ()=>onboardingGet(request("http://local/api/v1/onboarding","invalid-token")),
      ()=>onboardingPatch(request("http://local/api/v1/onboarding","invalid-token","PATCH",{step:0,draft:emptyDraft()})),
      ()=>onboardingPost(request("http://local/api/v1/onboarding","invalid-token","POST",{effectiveFrom:"2026-09-13",draft:namedDraft()})),
    ];
    for(const invoke of unauthenticated){const response=await invoke();expect(response.status).toBe(401);expect(await response.json()).toMatchObject({error:{code:"unauthorized"}})}
  });

  it("returns stable malformed JSON and field-error contracts",async()=>{
    const malformedHandlers=[
      ()=>settingsPatch(rawRequest("http://local/api/v1/me/settings",tokens[0],"PATCH","{")),
      ()=>focusPost(rawRequest("http://local/api/v1/focus-items",tokens[0],"POST","{")),
      ()=>focusPatch(rawRequest("http://local/api/v1/focus-items",tokens[0],"PATCH","{")),
      ()=>planPut(rawRequest("http://local/api/v1/weekly-plan",tokens[0],"PUT","{")),
      ()=>overridePut(rawRequest("http://local",tokens[0],"PUT","{"),{params:Promise.resolve({date:"2026-09-13",itemId:crypto.randomUUID()})}),
      ()=>timePost(rawRequest("http://local/api/v1/time-entries",tokens[0],"POST","{")),
      ()=>timeDelete(rawRequest("http://local/api/v1/time-entries",tokens[0],"DELETE","{")),
      ()=>completionPost(rawRequest("http://local/api/v1/completion-actions",tokens[0],"POST","{")),
      ()=>onboardingPatch(rawRequest("http://local/api/v1/onboarding",tokens[0],"PATCH","{")),
      ()=>onboardingPost(rawRequest("http://local/api/v1/onboarding",tokens[0],"POST","{")),
    ];
    for(const invoke of malformedHandlers){const response=await invoke();expect(response.status).toBe(400);expect(await response.json()).toEqual({error:{code:"invalid_json",message:"The request body must be valid JSON."}})}

    const invalidCases=[
      settingsPatch(request("http://local/api/v1/me/settings",tokens[0],"PATCH",{timezone:"Mars/Olympus"})),
      focusPost(request("http://local/api/v1/focus-items",tokens[0],"POST",{kind:"subtask",name:"Orphan",position:0,checklist:[]})),
      planPut(request("http://local/api/v1/weekly-plan",tokens[0],"PUT",{effectiveFrom:"2026-02-30",entries:[]})),
      timePost(request("http://local/api/v1/time-entries",tokens[0],"POST",{itemId:crypto.randomUUID(),date:"2026-02-30",minutes:0})),
      completionPost(request("http://local/api/v1/completion-actions",tokens[0],"POST",{itemId:crypto.randomUUID(),date:"2026-02-30",idempotencyKey:"short"})),
      onboardingPost(request("http://local/api/v1/onboarding",tokens[0],"POST",{effectiveFrom:"2026-02-30",draft:namedDraft()})),
    ];
    for(const promise of invalidCases){const response=await promise;expect(response.status).toBe(400);const body=await response.json();expect(body.error).toMatchObject({code:"validation_error",message:"The request is invalid.",fieldErrors:expect.any(Object)})}
    for(const route of [overridePut(request("http://local",tokens[0],"PUT",{operation:"skip"}),{params:Promise.resolve({date:"2026-02-30",itemId:crypto.randomUUID()})}),checklistPut(request("http://local",tokens[0],"PUT"),{params:Promise.resolve({date:"2026-02-30",stepId:crypto.randomUUID()})})]){const response=await route;expect(response.status).toBe(400);expect(await response.json()).toMatchObject({error:{code:"validation_error"}})}
    const reversed=await getCalendar(request("http://local/api/v1/calendar?from=2026-09-14&to=2026-09-13",tokens[0]));expect(reversed.status).toBe(400);expect(await reversed.json()).toMatchObject({error:{code:"validation_error"}});
  });

  it("accepts valid IANA timezone extremes and returns the canonical last write",async()=>{
    expect((await settingsPatch(request("http://local/api/v1/me/settings",tokens[0],"PATCH",{timezone:"Pacific/Kiritimati"}))).status).toBe(200);
    const latest=await data(await settingsPatch(request("http://local/api/v1/me/settings",tokens[0],"PATCH",{timezone:"Etc/GMT+12",weekStartsOn:0})));
    expect(latest).toMatchObject({timezone:"Etc/GMT+12",weekStartsOn:0});
    expect(await data(await settingsGet(request("http://local/api/v1/me/settings",tokens[0])))).toMatchObject(latest);
  });

  it("runs settings, focus items, planning, tracking, checklist, completion, undo, overrides, and isolation",async()=>{
    const patchResponse=await settingsPatch(request("http://local/api/v1/me/settings",tokens[0],"PATCH",{locale:"en",timezone:"Africa/Cairo",weekStartsOn:6,onboardingStep:1}));
    expect(patchResponse.status).toBe(200);
    expect((await data(patchResponse)).weekStartsOn).toBe(6);

    const created=await focusPost(request("http://local/api/v1/focus-items",tokens[0],"POST",{kind:"area",name:"Software",position:0,checklist:[{label:"Review",position:0,effectiveFrom:"2026-09-12"}]}));
    expect(created.status).toBe(201);
    const item=await data(created);itemId=item.id;stepId=item.checklist[0].id;
    const childResponse=await focusPost(request("http://local/api/v1/focus-items",tokens[0],"POST",{kind:"subtask",parentId:itemId,name:"Read",position:0,checklist:[]}));
    expect(childResponse.status).toBe(201);
    const other=await focusPost(request("http://local/api/v1/focus-items",tokens[1],"POST",{kind:"area",name:"Private",position:0,checklist:[]}));
    expect(other.status).toBe(201);
    otherItemId=(await data(other)).id;
    const isolated=await data(await focusGet(request("http://local/api/v1/focus-items",tokens[0])));
    expect(isolated.map((candidate:{name:string})=>candidate.name)).toEqual(expect.arrayContaining(["Software","Read"]));

    const plan=await planPut(request("http://local/api/v1/weekly-plan",tokens[0],"PUT",{effectiveFrom:"2026-09-12",entries:[{itemId,weekday:6,durationMinutes:120}]}));
    expect(plan.status).toBe(200);
    const time=await timePost(request("http://local/api/v1/time-entries",tokens[0],"POST",{itemId,date:"2026-09-12",minutes:30}));
    const timeEntry=await data(time);expect(timeEntry.itemId).toBe(itemId);
    const checked=await checklistPut(request("http://local",tokens[0],"PUT"),{params:Promise.resolve({date:"2026-09-12",stepId})});
    expect(checked.status).toBe(200);

    const completed=await completionPost(request("http://local/api/v1/completion-actions",tokens[0],"POST",{itemId,date:"2026-09-12",idempotencyKey:crypto.randomUUID()}));
    const action=await data(completed);actionId=action.id;
    expect(action.filledMinutes).toBe(90);
    let calendar=await data(await getCalendar(request("http://local/api/v1/calendar?from=2026-09-12&to=2026-09-12",tokens[0])));
    expect(calendar[0].items[0]).toMatchObject({actualMinutes:120,complete:true,completionActionId:actionId});

    expect((await completionDelete(request("http://local",tokens[0],"DELETE"),{params:Promise.resolve({id:actionId})})).status).toBe(200);
    calendar=await data(await getCalendar(request("http://local/api/v1/calendar?from=2026-09-12&to=2026-09-12",tokens[0])));
    expect(calendar[0].items[0]).toMatchObject({actualMinutes:30,complete:false});
    expect(calendar[0].items[0].checklist[0].completed).toBe(true);

    expect((await checklistDelete(request("http://local",tokens[0],"DELETE"),{params:Promise.resolve({date:"2026-09-12",stepId})})).status).toBe(204);
    expect((await overridePut(request("http://local",tokens[0],"PUT",{operation:"resize",durationMinutes:90}),{params:Promise.resolve({date:"2026-09-12",itemId})})).status).toBe(200);
    calendar=await data(await getCalendar(request("http://local/api/v1/calendar?from=2026-09-12&to=2026-09-12",tokens[0])));
    expect(calendar[0].items[0]).toMatchObject({targetMinutes:90,actualMinutes:30,complete:false});

    expect((await overrideDelete(request("http://local",tokens[0],"DELETE"),{params:Promise.resolve({date:"2026-09-12",itemId})})).status).toBe(204);
    const revised=await focusPatch(request("http://local/api/v1/focus-items",tokens[0],"PATCH",{id:itemId,name:"Engineering",checklistOperations:[{operation:"revise",id:stepId,label:"Plan",position:0,effectiveFrom:"2026-09-13"}]}));
    expect(revised.status).toBe(200);
    const revisedItem=await data(revised);
    expect(revisedItem.checklist).toEqual(expect.arrayContaining([
      expect.objectContaining({id:stepId,label:"Review",effectiveTo:"2026-09-12"}),
      expect.objectContaining({label:"Plan",effectiveFrom:"2026-09-13"}),
    ]));
    calendar=await data(await getCalendar(request("http://local/api/v1/calendar?from=2026-09-12&to=2026-09-12",tokens[0])));
    expect(calendar[0].items[0]).toMatchObject({item:{name:"Engineering"},targetMinutes:120,actualMinutes:30,checklist:[{label:"Review"}]});
    expect((await focusPatch(request("http://local/api/v1/focus-items",tokens[0],"PATCH",{id:itemId,archived:true}))).status).toBe(200);
    expect((await data(await focusGet(request("http://local/api/v1/focus-items",tokens[0])))).length).toBe(0);
    expect((await focusPatch(request("http://local/api/v1/focus-items",tokens[0],"PATCH",{id:itemId,archived:false}))).status).toBe(200);
    expect((await data(await focusGet(request("http://local/api/v1/focus-items",tokens[0])))).length).toBe(2);

    expect((await focusPatch(request("http://local/api/v1/focus-items",tokens[0],"PATCH",{id:otherItemId,name:"Stolen"}))).status).toBe(404);
    expect((await planPut(request("http://local/api/v1/weekly-plan",tokens[0],"PUT",{effectiveFrom:"2026-09-13",entries:[{itemId:otherItemId,weekday:0,durationMinutes:10}]}))).status).toBe(400);
    expect((await timePost(request("http://local/api/v1/time-entries",tokens[1],"POST",{itemId,date:"2026-09-12",minutes:10}))).status).toBe(400);
    expect((await overridePut(request("http://local",tokens[1],"PUT",{operation:"resize",durationMinutes:10}),{params:Promise.resolve({date:"2026-09-12",itemId})})).status).toBe(400);
    expect((await checklistPut(request("http://local",tokens[1],"PUT"),{params:Promise.resolve({date:"2026-09-12",stepId})})).status).toBe(404);
    expect((await completionPost(request("http://local/api/v1/completion-actions",tokens[1],"POST",{itemId,date:"2026-09-12",idempotencyKey:crypto.randomUUID()}))).status).toBe(400);
    expect((await completionDelete(request("http://local",tokens[1],"DELETE"),{params:Promise.resolve({id:actionId})})).status).toBe(400);
    expect((await timeDelete(request("http://local/api/v1/time-entries",tokens[1],"DELETE",{id:timeEntry.id}))).status).toBe(204);
    expect((await overrideDelete(request("http://local",tokens[1],"DELETE"),{params:Promise.resolve({date:"2026-09-12",itemId})})).status).toBe(204);
    calendar=await data(await getCalendar(request("http://local/api/v1/calendar?from=2026-09-12&to=2026-09-12",tokens[0])));
    expect(calendar[0].items[0].actualMinutes).toBe(30);
    expect((await data(await focusGet(request("http://local/api/v1/focus-items",tokens[1]))))[0].name).toBe("Private");
  });

  it("returns canonical focus, plan, and override values after repeated writes",async()=>{
    const renamed=await data(await focusPatch(request("http://local/api/v1/focus-items",tokens[0],"PATCH",{id:itemId,name:"Deep Engineering"})));
    const finalName=await data(await focusPatch(request("http://local/api/v1/focus-items",tokens[0],"PATCH",{id:itemId,name:"Platform Engineering"})));
    expect(renamed.name).toBe("Deep Engineering");expect(finalName.name).toBe("Platform Engineering");
    await planPut(request("http://local/api/v1/weekly-plan",tokens[0],"PUT",{effectiveFrom:"2026-09-14",entries:[{itemId,weekday:1,durationMinutes:30}]}));
    const plans=await data(await planPut(request("http://local/api/v1/weekly-plan",tokens[0],"PUT",{effectiveFrom:"2026-09-14",entries:[{itemId,weekday:1,durationMinutes:75}]})));
    expect(plans.find((plan:{effectiveFrom:string})=>plan.effectiveFrom==="2026-09-14").entries).toEqual([{itemId,weekday:1,durationMinutes:75}]);
    await overridePut(request("http://local",tokens[0],"PUT",{operation:"resize",durationMinutes:40}),{params:Promise.resolve({date:"2026-09-14",itemId})});
    expect(await data(await overridePut(request("http://local",tokens[0],"PUT",{operation:"resize",durationMinutes:55}),{params:Promise.resolve({date:"2026-09-14",itemId})}))).toMatchObject({date:"2026-09-14",itemId,operation:"resize",durationMinutes:55});
  });

  it("persists an onboarding draft across clients and finalizes it exactly once",async()=>{
    const draft={language:"ar",timezone:"Africa/Cairo",weekStart:6,items:[
      {clientId:"area",kind:"area",name:"التعلم",checklist:["راجع الخطة"],weekdays:[1,3],target:"90"},
      {clientId:"child",kind:"subtask",parentClientId:"area",name:"القراءة",checklist:[],weekdays:[1,3],target:"30"},
    ]};
    expect((await onboardingPatch(request("http://local/api/v1/onboarding",tokens[2],"PATCH",{step:2,draft}))).status).toBe(200);
    const restored=await data(await onboardingGet(request("http://local/api/v1/onboarding",tokens[2])));
    expect(restored).toMatchObject({step:2,draft,completed:false});

    const first=await data(await onboardingPost(request("http://local/api/v1/onboarding",tokens[2],"POST",{effectiveFrom:"2026-09-13",draft})));
    const retry=await data(await onboardingPost(request("http://local/api/v1/onboarding",tokens[2],"POST",{effectiveFrom:"2026-09-13",draft})));
    expect(first.settings).toMatchObject({locale:"ar",onboardingStep:3,onboardingCompleted:true});
    expect(first.items).toHaveLength(2);
    expect(retry.items.map((item:{id:string})=>item.id).sort()).toEqual(first.items.map((item:{id:string})=>item.id).sort());
    expect(retry.plans).toEqual(first.plans);
    expect((await data(await onboardingGet(request("http://local/api/v1/onboarding",tokens[2])))).draft).toBeNull();
  });
});

function request(url:string,token:string,method="GET",body?:unknown){return new Request(url,{method,headers:{Authorization:`Bearer ${token}`,...(body?{"Content-Type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{})})}
function rawRequest(url:string,token:string,method:string,body:string){return new Request(url,{method,headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body})}
async function data(response:Response){const body=await response.json();if(!response.ok)throw new Error(JSON.stringify(body));return body.data}
function emptyDraft(){return {language:"en" as const,timezone:"Africa/Cairo",weekStart:6 as const,items:[]}}
function namedDraft(){return {language:"en" as const,timezone:"Africa/Cairo",weekStart:6 as const,items:[{clientId:"area",kind:"area" as const,name:"Deep work",checklist:[],weekdays:[1],target:"60"}]}}
