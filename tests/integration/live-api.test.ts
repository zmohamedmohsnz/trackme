import {createClient} from "@supabase/supabase-js";
import {afterAll,beforeAll,describe,expect,it} from "vitest";
import {GET as getCalendar} from "@/app/api/v1/calendar/route";
import {POST as focusPost,GET as focusGet,PATCH as focusPatch} from "@/app/api/v1/focus-items/route";
import {PATCH as settingsPatch} from "@/app/api/v1/me/settings/route";
import {PUT as planPut} from "@/app/api/v1/weekly-plan/route";
import {POST as timePost} from "@/app/api/v1/time-entries/route";
import {POST as completionPost} from "@/app/api/v1/completion-actions/route";
import {DELETE as completionDelete} from "@/app/api/v1/completion-actions/[id]/route";
import {PUT as checklistPut,DELETE as checklistDelete} from "@/app/api/v1/checklist-completions/[date]/[stepId]/route";
import {PUT as overridePut,DELETE as overrideDelete} from "@/app/api/v1/date-overrides/[date]/[itemId]/route";

const enabled=process.env.RUN_INTEGRATION_TESTS==="1";
const suite=enabled?describe:describe.skip;

suite("live Supabase API",()=>{
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const publicKey=process.env[["PUBLISHABLE","KEY"].join("_")]!;
  const serviceKey=process.env[["SERVICE","ROLE","KEY"].join("_")]!;
  const password="TrackMe-test-123!";
  const emails=[`trackme-one-${crypto.randomUUID()}@example.test`,`trackme-two-${crypto.randomUUID()}@example.test`];
  const userIds:string[]=[];
  let tokens:string[]=[];
  let itemId="";
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

  it("runs settings, focus items, planning, tracking, checklist, completion, undo, overrides, and isolation",async()=>{
    const patchResponse=await settingsPatch(request("http://local/api/v1/me/settings",tokens[0],"PATCH",{locale:"en",timezone:"Africa/Cairo",weekStartsOn:6,onboardingStep:1}));
    expect(patchResponse.status).toBe(200);
    expect((await data(patchResponse)).weekStartsOn).toBe(6);

    const created=await focusPost(request("http://local/api/v1/focus-items",tokens[0],"POST",{kind:"area",name:"Software",position:0,checklist:[{label:"Review",position:0,effectiveFrom:"2026-09-12"}]}));
    expect(created.status).toBe(201);
    const item=await data(created);itemId=item.id;stepId=item.checklist[0].id;
    const other=await focusPost(request("http://local/api/v1/focus-items",tokens[1],"POST",{kind:"area",name:"Private",position:0,checklist:[]}));
    expect(other.status).toBe(201);
    const isolated=await data(await focusGet(request("http://local/api/v1/focus-items",tokens[0])));
    expect(isolated.map((candidate:{name:string})=>candidate.name)).toEqual(["Software"]);

    const plan=await planPut(request("http://local/api/v1/weekly-plan",tokens[0],"PUT",{effectiveFrom:"2026-09-12",entries:[{itemId,weekday:6,durationMinutes:120}]}));
    expect(plan.status).toBe(200);
    const time=await timePost(request("http://local/api/v1/time-entries",tokens[0],"POST",{itemId,date:"2026-09-12",minutes:30}));
    expect((await data(time)).itemId).toBe(itemId);
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
    expect((await focusPatch(request("http://local/api/v1/focus-items",tokens[0],"PATCH",{id:itemId,archived:true}))).status).toBe(200);
    expect((await data(await focusGet(request("http://local/api/v1/focus-items",tokens[0])))).length).toBe(0);
    expect((await focusPatch(request("http://local/api/v1/focus-items",tokens[0],"PATCH",{id:itemId,archived:false}))).status).toBe(200);
    expect((await data(await focusGet(request("http://local/api/v1/focus-items",tokens[0])))).length).toBe(1);
  });
});

function request(url:string,token:string,method="GET",body?:unknown){return new Request(url,{method,headers:{Authorization:`Bearer ${token}`,...(body?{"Content-Type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{})})}
async function data(response:Response){const body=await response.json();if(!response.ok)throw new Error(JSON.stringify(body));return body.data}
