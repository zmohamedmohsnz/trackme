"use client";

import {useCallback,useEffect,useRef,useState} from "react";
import {ArrowLeft,ArrowRight,Check,Plus,Sparkles,Trash2} from "lucide-react";
import {useLocale,useTranslations} from "next-intl";
import {useRouter} from "next/navigation";
import {toast} from "sonner";
import type {OnboardingDraft,OnboardingDraftItem,OnboardingResult,OnboardingState,Weekday} from "@/types/domain";
import {todayInTimeZone} from "@/lib/domain/dates";
import {ApiClientError,apiFetch,demoMode,getSettings} from "./api-client";
import {ValidationFeedback} from "./validation-feedback";
import {Button} from "./ui/button";
import {Card,CardContent,CardDescription,CardHeader,CardTitle} from "./ui/card";
import {Input} from "./ui/input";
import {Label} from "./ui/label";
import {Progress} from "./ui/progress";
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from "./ui/select";

const NONE="unassigned";
const initial:OnboardingDraft={language:"en",timezone:"",weekStart:6,areas:[],tasks:[{clientId:"task-1",areaClientId:null,name:"",checklist:[""],weekdays:[1,3,6],target:"15"}]};
function normalizeDraft(value:OnboardingDraft):OnboardingDraft{
  if(Array.isArray(value.areas)&&Array.isArray(value.tasks))return value;
  const legacy=value as unknown as OnboardingDraft & {items?:Array<OnboardingDraftItem&{kind?:"area"|"subtask";parentClientId?:string}>};
  const old=legacy.items??[];
  return {language:value.language,timezone:value.timezone,weekStart:value.weekStart,
    areas:old.filter(item=>item.kind==="area").map(item=>({clientId:item.clientId,name:item.name})),
    tasks:old.map(item=>({...item,clientId:item.kind==="area"?`${item.clientId}:general`:item.clientId,areaClientId:item.kind==="area"?item.clientId:item.parentClientId??null,name:item.kind==="area"?"General":item.name})).filter(item=>item.kind==="area"||item.kind==="subtask").map(({clientId,areaClientId,name,checklist,weekdays,target})=>({clientId,areaClientId,name,checklist,weekdays,target}))};
}

export function OnboardingWizard(){
  const t=useTranslations("Onboarding");
  const v=useTranslations("Validation");
  const locale=useLocale();
  const router=useRouter();
  const [step,setStep]=useState(0);
  const [draft,setDraft]=useState<OnboardingDraft>(initial);
  const [busy,setBusy]=useState(false);
  const [hydrated,setHydrated]=useState(false);
  const [storageKey,setStorageKey]=useState("");
  const [fieldErrors,setFieldErrors]=useState<Record<string,string>>({});
  const saveQueue=useRef<Promise<void>>(Promise.resolve());
  const persistDraft=useCallback((nextStep:number,nextDraft:OnboardingDraft)=>{
    const save=()=>apiFetch("/api/v1/onboarding",{method:"PATCH",body:JSON.stringify({step:nextStep,draft:nextDraft})}).then(()=>undefined);
    const pending=saveQueue.current.then(save,save);
    saveQueue.current=pending.catch(()=>undefined);
    return pending;
  },[]);

  useEffect(()=>{let active=true;Promise.resolve().then(async()=>{
    let key="trackme:onboarding:demo";
    if(demoMode){
      const saved=localStorage.getItem(key);
      if(saved){try{const parsed=JSON.parse(saved) as {draft:OnboardingDraft;step:number};if(active){setDraft(normalizeDraft(parsed.draft));setStep(parsed.step)}}catch{}}
      else{const settings=await getSettings().catch(()=>null);if(active)setDraft(current=>({...current,language:(settings?.locale??locale) as "en"|"ar",timezone:settings?.timezone||Intl.DateTimeFormat().resolvedOptions().timeZone,weekStart:settings?.weekStartsOn??6}))}
    }else{
      const {createClient}=await import("@/lib/supabase/client");
      const {data}=await createClient().auth.getUser();
      if(!data.user)return;
      key=`trackme:onboarding:${data.user.id}`;
      const [state,settings]=await Promise.all([apiFetch<OnboardingState>("/api/v1/onboarding"),getSettings().catch(()=>null)]);
      const legacy=localStorage.getItem(key);
      let restored=state.draft;
      let restoredStep=state.step;
      if(!restored&&legacy){try{const parsed=JSON.parse(legacy) as {draft:OnboardingDraft;step:number};restored=normalizeDraft(parsed.draft);restoredStep=Math.min(parsed.step,2);await apiFetch("/api/v1/onboarding",{method:"PATCH",body:JSON.stringify({step:restoredStep,draft:restored})});localStorage.removeItem(key)}catch{}}
      if(active){setDraft(restored?normalizeDraft(restored):{...initial,language:(settings?.locale??locale) as "en"|"ar",timezone:settings?.timezone||Intl.DateTimeFormat().resolvedOptions().timeZone,weekStart:settings?.weekStartsOn??6});setStep(restoredStep)}
    }
    if(active){setStorageKey(key);setHydrated(true)}
  }).catch(()=>{if(active){toast.error(t("error"));setHydrated(true)}});return()=>{active=false}},[locale,t]);
  useEffect(()=>{
    if(!hydrated)return;
    if(demoMode){if(storageKey)localStorage.setItem(storageKey,JSON.stringify({step,draft}));return}
    const timeout=window.setTimeout(()=>{void persistDraft(step,draft).catch(()=>{})},400);
    return()=>window.clearTimeout(timeout);
  },[step,draft,hydrated,storageKey,persistDraft]);

  function updateItem(clientId:string,change:Partial<OnboardingDraftItem>){setDraft(current=>({...current,tasks:current.tasks.map(item=>item.clientId===clientId?{...item,...change}:item)}))}
  function addArea(){setDraft(current=>({...current,areas:[...current.areas,{clientId:crypto.randomUUID(),name:""}]}))}
  function addTask(){setDraft(current=>({...current,tasks:[...current.tasks,{clientId:crypto.randomUUID(),areaClientId:null,name:"",checklist:[""],weekdays:[],target:"15"}]}))}
  function removeArea(clientId:string){setDraft(current=>({...current,areas:current.areas.filter(area=>area.clientId!==clientId),tasks:current.tasks.map(task=>task.areaClientId===clientId?{...task,areaClientId:null}:task)}))}
  function removeTask(clientId:string){setDraft(current=>({...current,tasks:current.tasks.filter(item=>item.clientId!==clientId)}))}
  function patchChecklist(item:OnboardingDraftItem,index:number,value:string){const checklist=[...item.checklist];checklist[index]=value;updateItem(item.clientId,{checklist})}
  function localizedApiErrors(error:ApiClientError){const next:Record<string,string>={};for(const path of Object.keys(error.fieldErrors)){if(path==="draft.timezone")next[path]=v("timezone");else if(/\.target$/.test(path))next[path]=v("duration");else if(/\.(name|checklist\.\d+)$/.test(path))next[path]=v("name");else next[path]=v("required")}return next}
  function showErrorStep(errors:Record<string,string>){const paths=Object.keys(errors);if(paths.some(path=>path==="draft.timezone"||path==="draft.language"||path==="draft.weekStart"))setStep(0);else if(paths.some(path=>path.startsWith("draft.areas")||path==="draft.tasks"||/draft\.tasks\.\d+\.(name|checklist|areaClientId)/.test(path)))setStep(1);else if(paths.length)setStep(2)}
  function finalErrors(){const next:Record<string,string>={};try{new Intl.DateTimeFormat("en",{timeZone:draft.timezone}).format()}catch{next["draft.timezone"]=v("timezone")}draft.areas.forEach((area,index)=>{if(area.name.trim().length>200)next[`draft.areas.${index}.name`]=v("name")});draft.tasks.forEach((item,index)=>{if(!item.name.trim()||item.name.trim().length>200)next[`draft.tasks.${index}.name`]=v(item.name.trim()?"name":"required");const minutes=Number(item.target);if(!Number.isInteger(minutes)||minutes<1||minutes>1440)next[`draft.tasks.${index}.target`]=v("duration");item.checklist.forEach((label,stepIndex)=>{if(label.trim().length>200)next[`draft.tasks.${index}.checklist.${stepIndex}`]=v("name")})});if(!draft.tasks.some(item=>item.name.trim()))next["draft.tasks"]=v("required");return next}
  async function navigate(next:number){setFieldErrors({});setBusy(true);try{if(demoMode){if(storageKey)localStorage.setItem(storageKey,JSON.stringify({step:next,draft}))}else await persistDraft(next,draft);setStep(next)}catch(error){if(error instanceof ApiClientError){const errors=localizedApiErrors(error);setFieldErrors(errors);showErrorStep(errors)}else toast.error(t("error"))}finally{setBusy(false)}}

  async function finish(){
    const nextErrors=finalErrors();setFieldErrors(nextErrors);if(Object.keys(nextErrors).length){showErrorStep(nextErrors);return}
    const today=todayInTimeZone(draft.timezone);
    setBusy(true);
    try{
      await apiFetch<OnboardingResult>("/api/v1/onboarding",{method:"POST",body:JSON.stringify({effectiveFrom:today,draft})},()=>({settings:{locale:draft.language,timezone:draft.timezone,weekStartsOn:draft.weekStart,onboardingStep:3,onboardingCompleted:true},items:[],plans:[]}));
      if(storageKey)localStorage.removeItem(storageKey);router.push(`/${draft.language}/calendar`);toast.success(t("ready"));
    }catch(error){if(error instanceof ApiClientError){const errors=localizedApiErrors(error);setFieldErrors(errors);showErrorStep(errors)}else toast.error(t("error"))}finally{setBusy(false)}
  }

  const areas=draft.areas;
  const orderedDays=Array.from({length:7},(_,index)=>((draft.weekStart+index)%7) as Weekday);
  const fields=[
    <div key="prefs" className="grid gap-4 sm:grid-cols-2"><Field label={t("language")}><Select value={draft.language} onValueChange={value=>setDraft(current=>({...current,language:value as "en"|"ar"}))}><SelectTrigger aria-label={t("language")}><SelectValue/></SelectTrigger><SelectContent><SelectItem value="en">English</SelectItem><SelectItem value="ar">العربية</SelectItem></SelectContent></Select></Field><Field label={t("timezone")}><Input aria-label={t("timezone")} value={draft.timezone} onChange={event=>{setDraft(current=>({...current,timezone:event.target.value}));setFieldErrors(current=>({...current,"draft.timezone":""}))}} placeholder="Africa/Cairo" aria-invalid={!!fieldErrors["draft.timezone"]} aria-describedby={fieldErrors["draft.timezone"]?"onboarding-timezone-error":undefined}/><ValidationFeedback id="onboarding-timezone-error" message={fieldErrors["draft.timezone"]}/></Field><Field label={t("weekStart")}><Select value={String(draft.weekStart)} onValueChange={value=>setDraft(current=>({...current,weekStart:Number(value) as Weekday}))}><SelectTrigger aria-label={t("weekStart")}><SelectValue/></SelectTrigger><SelectContent>{[0,1,2,3,4,5,6].map(day=><SelectItem key={day} value={String(day)}>{weekdayLong(day as Weekday,locale)}</SelectItem>)}</SelectContent></Select></Field></div>,
    <div key="focus" className="space-y-4"><div className="space-y-2">{areas.map((area,index)=>{const path=`draft.areas.${index}.name`;return <div key={area.clientId} className="flex gap-2"><Input aria-label={t("area")} value={area.name} onChange={event=>setDraft(current=>({...current,areas:current.areas.map(value=>value.clientId===area.clientId?{...value,name:event.target.value}:value)}))} placeholder={t("areaPlaceholder")}/><Button size="icon" variant="ghost" onClick={()=>removeArea(area.clientId)} aria-label={t("remove")}><Trash2 className="size-4"/></Button><ValidationFeedback id={`${area.clientId}-error`} message={fieldErrors[path]}/></div>})}<Button variant="outline" onClick={addArea}><Plus className="size-4"/>{t("addArea")}</Button></div>{draft.tasks.map((task,index)=>{const path=`draft.tasks.${index}.name`;return <div key={task.clientId} className="rounded-lg border p-4"><div className="grid gap-2 sm:grid-cols-[1fr_12rem_auto]"><Input aria-label={t("subtask")} value={task.name} onChange={event=>updateItem(task.clientId,{name:event.target.value})} placeholder={t("subtaskPlaceholder")}/><Select value={task.areaClientId??NONE} onValueChange={value=>updateItem(task.clientId,{areaClientId:value===NONE?null:value})}><SelectTrigger aria-label={t("taskArea")}><SelectValue/></SelectTrigger><SelectContent><SelectItem value={NONE}>{t("unassigned")}</SelectItem>{areas.map(area=><SelectItem key={area.clientId} value={area.clientId}>{area.name||t("unnamedArea")}</SelectItem>)}</SelectContent></Select><Button size="icon" variant="ghost" onClick={()=>removeTask(task.clientId)} aria-label={t("remove")}><Trash2 className="size-4"/></Button></div><ValidationFeedback id={`${task.clientId}-error`} message={fieldErrors[path]}/><ChecklistEditor item={task} basePath={`draft.tasks.${index}`} fieldErrors={fieldErrors} setFieldErrors={setFieldErrors} t={t} patch={patchChecklist} update={updateItem}/></div>})}<Button variant="outline" onClick={addTask}><Plus className="size-4"/>{t("addSubtask")}</Button></div>,
    <div key="schedule" className="space-y-4">{draft.tasks.filter(item=>item.name.trim()).map(item=>{const index=draft.tasks.indexOf(item),path=`draft.tasks.${index}.target`;return <div key={item.clientId} className="rounded-lg border p-4"><div className="font-medium">{item.name}</div><Field label={t("weekdays")}><div className="grid grid-cols-4 gap-2 sm:grid-cols-7">{orderedDays.map(day=><button type="button" key={day} onClick={()=>updateItem(item.clientId,{weekdays:item.weekdays.includes(day)?item.weekdays.filter(value=>value!==day):[...item.weekdays,day]})} className={`rounded-md border px-2 py-2 text-xs ${item.weekdays.includes(day)?"bg-primary text-primary-foreground":"bg-background"}`}>{t(`day${day}`)}</button>)}</div></Field><Field label={t("target")}><Input aria-label={`${item.name} ${t("target")}`} type="number" min="1" max="1440" value={item.target} onChange={event=>{updateItem(item.clientId,{target:event.target.value});setFieldErrors(current=>({...current,[path]:""}))}} aria-invalid={!!fieldErrors[path]} aria-describedby={fieldErrors[path]?`${item.clientId}-target-error`:undefined}/><ValidationFeedback id={`${item.clientId}-target-error`} message={fieldErrors[path]}/></Field></div>})}</div>,
  ];
  const hasTask=draft.tasks.some(task=>task.name.trim());return <main className="grid min-h-[calc(100vh-33px)] place-items-center bg-muted/30 p-4"><Card className="w-full max-w-3xl"><CardHeader><div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Sparkles className="size-4"/>TrackMe</div><Progress value={(step+1)/3*100}/><CardTitle className="pt-4 text-2xl">{t(`step${step+1}Title`)}</CardTitle><CardDescription>{t(`step${step+1}Description`)}</CardDescription></CardHeader><CardContent>{fields[step]}<div className="mt-8 flex justify-between"><Button variant="ghost" disabled={!hydrated||step===0||busy} onClick={()=>navigate(step-1)}><ArrowLeft className="size-4 rtl:rotate-180"/>{t("back")}</Button>{step<2?<Button disabled={!hydrated||busy||step===1&&!hasTask} onClick={()=>navigate(step+1)}>{t("continue")}<ArrowRight className="size-4 rtl:rotate-180"/></Button>:<Button disabled={!hydrated||busy||!hasTask} onClick={finish}><Check className="size-4"/>{t("finish")}</Button>}</div></CardContent></Card></main>;
}

function ChecklistEditor({item,basePath,fieldErrors,setFieldErrors,t,patch,update}:{item:OnboardingDraftItem;basePath:string;fieldErrors:Record<string,string>;setFieldErrors:React.Dispatch<React.SetStateAction<Record<string,string>>>;t:(key:string)=>string;patch:(item:OnboardingDraftItem,index:number,value:string)=>void;update:(id:string,change:Partial<OnboardingDraftItem>)=>void}){return <div className="mt-3 space-y-2"><Label>{t("checklist")}</Label>{item.checklist.map((value,index)=>{const path=`${basePath}.checklist.${index}`;return <div key={index} className="flex gap-2"><div className="min-w-0 flex-1"><Input value={value} onChange={event=>{patch(item,index,event.target.value);setFieldErrors(current=>({...current,[path]:""}))}} placeholder={t("checklistPlaceholder")} aria-invalid={!!fieldErrors[path]} aria-describedby={fieldErrors[path]?`${item.clientId}-checklist-${index}-error`:undefined}/><ValidationFeedback id={`${item.clientId}-checklist-${index}-error`} message={fieldErrors[path]}/></div>{item.checklist.length>1&&<Button size="icon" variant="ghost" onClick={()=>update(item.clientId,{checklist:item.checklist.filter((_,candidate)=>candidate!==index)})}><Trash2 className="size-4"/></Button>}</div>})}<Button size="sm" variant="ghost" onClick={()=>update(item.clientId,{checklist:[...item.checklist,""]})}><Plus className="size-4"/>{t("addChecklist")}</Button></div>}
function Field({label,children}:{label:string;children:React.ReactNode}){return <div className="space-y-2"><Label>{label}</Label>{children}</div>}
function weekdayLong(day:Weekday,locale:string){return new Intl.DateTimeFormat(locale,{weekday:"long",timeZone:"UTC"}).format(new Date(Date.UTC(2024,0,7+day)))}
