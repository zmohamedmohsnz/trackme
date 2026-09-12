"use client";

import {useEffect,useState} from "react";
import {ArrowLeft,ArrowRight,Check,Plus,Sparkles,Trash2} from "lucide-react";
import {useLocale,useTranslations} from "next-intl";
import {useRouter} from "next/navigation";
import {toast} from "sonner";
import type {FocusItem,IsoDate,Weekday} from "@/types/domain";
import {apiFetch,getSettings} from "./api-client";
import {Button} from "./ui/button";
import {Card,CardContent,CardDescription,CardHeader,CardTitle} from "./ui/card";
import {Input} from "./ui/input";
import {Label} from "./ui/label";
import {Progress} from "./ui/progress";

type DraftItem={clientId:string;kind:"area"|"subtask";parentClientId?:string;name:string;checklist:string[];weekdays:Weekday[];target:string};
type Draft={language:"en"|"ar";timezone:string;weekStart:Weekday;items:DraftItem[]};
const initial:Draft={language:"en",timezone:"",weekStart:6,items:[
  {clientId:"area-1",kind:"area",name:"",checklist:[""],weekdays:[1,3,6],target:"120"},
  {clientId:"subtask-1",kind:"subtask",parentClientId:"area-1",name:"",checklist:[""],weekdays:[1,3,6],target:"15"},
]};

export function OnboardingWizard(){
  const t=useTranslations("Onboarding");
  const locale=useLocale();
  const router=useRouter();
  const [step,setStep]=useState(0);
  const [draft,setDraft]=useState(initial);
  const [busy,setBusy]=useState(false);
  const [hydrated,setHydrated]=useState(false);

  useEffect(()=>{let active=true;Promise.resolve().then(async()=>{const saved=localStorage.getItem("trackme:onboarding");if(saved){try{const parsed=JSON.parse(saved) as {draft:Draft;step:number};if(active){setDraft(parsed.draft);setStep(parsed.step)}}catch{}}else{const settings=await getSettings().catch(()=>null);if(active)setDraft(current=>({...current,language:(settings?.locale??locale) as "en"|"ar",timezone:settings?.timezone||Intl.DateTimeFormat().resolvedOptions().timeZone,weekStart:settings?.weekStartsOn??6}));if(active&&settings)setStep(Math.min(settings.onboardingStep,2))}if(active)setHydrated(true)});return()=>{active=false}},[locale]);
  useEffect(()=>{if(hydrated)localStorage.setItem("trackme:onboarding",JSON.stringify({step,draft}))},[step,draft,hydrated]);

  function updateItem(clientId:string,change:Partial<DraftItem>){setDraft(current=>({...current,items:current.items.map(item=>item.clientId===clientId?{...item,...change}:item)}))}
  function addArea(){setDraft(current=>({...current,items:[...current.items,{clientId:crypto.randomUUID(),kind:"area",name:"",checklist:[""],weekdays:[],target:"60"}]}))}
  function addSubtask(parentClientId:string){setDraft(current=>({...current,items:[...current.items,{clientId:crypto.randomUUID(),kind:"subtask",parentClientId,name:"",checklist:[""],weekdays:[],target:"15"}]}))}
  function removeItem(clientId:string){setDraft(current=>({...current,items:current.items.filter(item=>item.clientId!==clientId&&item.parentClientId!==clientId)}))}
  function patchChecklist(item:DraftItem,index:number,value:string){const checklist=[...item.checklist];checklist[index]=value;updateItem(item.clientId,{checklist})}
  async function navigate(next:number){setBusy(true);try{await apiFetch("/api/v1/me/settings",{method:"PATCH",body:JSON.stringify({locale:draft.language,timezone:draft.timezone,weekStartsOn:draft.weekStart,onboardingStep:next})},()=>({}));setStep(next)}catch(error){toast.error(error instanceof Error?error.message:t("error"))}finally{setBusy(false)}}

  async function finish(){
    const today=new Date().toISOString().slice(0,10) as IsoDate;
    setBusy(true);
    try{
      const ids=new Map<string,string>();
      const areas=draft.items.filter(item=>item.kind==="area"&&item.name.trim());
      for(const [position,item] of areas.entries()){
        const created=await apiFetch<FocusItem>("/api/v1/focus-items",{method:"POST",body:JSON.stringify({kind:"area",name:item.name,position,checklist:item.checklist.filter(Boolean).map((label,index)=>({label,position:index,effectiveFrom:today}))})},()=>({id:crypto.randomUUID(),kind:"area",name:item.name,position,checklist:[]}));
        ids.set(item.clientId,created.id);
      }
      const subtasks=draft.items.filter(item=>item.kind==="subtask"&&item.name.trim()&&item.parentClientId&&ids.has(item.parentClientId));
      for(const [position,item] of subtasks.entries()){
        const created=await apiFetch<FocusItem>("/api/v1/focus-items",{method:"POST",body:JSON.stringify({kind:"subtask",parentId:ids.get(item.parentClientId!),name:item.name,position,checklist:item.checklist.filter(Boolean).map((label,index)=>({label,position:index,effectiveFrom:today}))})},()=>({id:crypto.randomUUID(),kind:"subtask",parentId:ids.get(item.parentClientId!),name:item.name,position,checklist:[]}));
        ids.set(item.clientId,created.id);
      }
      const entries=draft.items.flatMap(item=>{const itemId=ids.get(item.clientId);const durationMinutes=Number(item.target);return itemId&&Number.isInteger(durationMinutes)&&durationMinutes>=1&&durationMinutes<=1440?item.weekdays.map(weekday=>({itemId,weekday,durationMinutes})):[]});
      await apiFetch("/api/v1/weekly-plan",{method:"PUT",body:JSON.stringify({effectiveFrom:today,entries})},()=>({}));
      await apiFetch("/api/v1/me/settings",{method:"PATCH",body:JSON.stringify({locale:draft.language,timezone:draft.timezone,weekStartsOn:draft.weekStart,onboardingStep:3,onboardingCompleted:true})},()=>({}));
      localStorage.removeItem("trackme:onboarding");router.push(`/${draft.language}/calendar`);toast.success(t("ready"));
    }catch(error){toast.error(error instanceof Error?error.message:t("error"))}finally{setBusy(false)}
  }

  const areas=draft.items.filter(item=>item.kind==="area");
  const orderedDays=Array.from({length:7},(_,index)=>((draft.weekStart+index)%7) as Weekday);
  const fields=[
    <div key="prefs" className="grid gap-4 sm:grid-cols-2"><Field label={t("language")}><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={draft.language} onChange={event=>setDraft(current=>({...current,language:event.target.value as "en"|"ar"}))}><option value="en">English</option><option value="ar">العربية</option></select></Field><Field label={t("timezone")}><Input value={draft.timezone} onChange={event=>setDraft(current=>({...current,timezone:event.target.value}))} placeholder="Africa/Cairo"/></Field><Field label={t("weekStart")}><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={draft.weekStart} onChange={event=>setDraft(current=>({...current,weekStart:Number(event.target.value) as Weekday}))}>{[0,1,2,3,4,5,6].map(day=><option key={day} value={day}>{weekdayLong(day as Weekday,locale)}</option>)}</select></Field></div>,
    <div key="focus" className="space-y-4">{areas.map(area=><div key={area.clientId} className="rounded-lg border p-4"><div className="flex gap-2"><Input value={area.name} onChange={event=>updateItem(area.clientId,{name:event.target.value})} placeholder={t("areaPlaceholder")}/>{areas.length>1&&<Button size="icon" variant="ghost" onClick={()=>removeItem(area.clientId)} aria-label={t("remove")}><Trash2 className="size-4"/></Button>}</div><ChecklistEditor item={area} t={t} patch={patchChecklist} update={updateItem}/><div className="mt-4 space-y-3 border-s-2 ps-4">{draft.items.filter(item=>item.parentClientId===area.clientId).map(subtask=><div key={subtask.clientId} className="rounded-md bg-muted/40 p-3"><div className="flex gap-2"><Input value={subtask.name} onChange={event=>updateItem(subtask.clientId,{name:event.target.value})} placeholder={t("subtaskPlaceholder")}/><Button size="icon" variant="ghost" onClick={()=>removeItem(subtask.clientId)} aria-label={t("remove")}><Trash2 className="size-4"/></Button></div><ChecklistEditor item={subtask} t={t} patch={patchChecklist} update={updateItem}/></div>)}</div><Button className="mt-3" size="sm" variant="outline" onClick={()=>addSubtask(area.clientId)}><Plus className="size-4"/>{t("addSubtask")}</Button></div>)}<Button variant="outline" onClick={addArea}><Plus className="size-4"/>{t("addArea")}</Button></div>,
    <div key="schedule" className="space-y-4">{draft.items.filter(item=>item.name.trim()).map(item=><div key={item.clientId} className="rounded-lg border p-4"><div className="font-medium">{item.name}</div><Field label={t("weekdays")}><div className="grid grid-cols-4 gap-2 sm:grid-cols-7">{orderedDays.map(day=><button type="button" key={day} onClick={()=>updateItem(item.clientId,{weekdays:item.weekdays.includes(day)?item.weekdays.filter(value=>value!==day):[...item.weekdays,day]})} className={`rounded-md border px-2 py-2 text-xs ${item.weekdays.includes(day)?"bg-primary text-primary-foreground":"bg-background"}`}>{t(`day${day}`)}</button>)}</div></Field><Field label={t("target")}><Input type="number" min="1" max="1440" value={item.target} onChange={event=>updateItem(item.clientId,{target:event.target.value})}/></Field></div>)}</div>,
  ];
  return <main className="grid min-h-[calc(100vh-33px)] place-items-center bg-muted/30 p-4"><Card className="w-full max-w-3xl"><CardHeader><div className="mb-2 flex items-center gap-2 text-sm font-semibold"><Sparkles className="size-4"/>TrackMe</div><Progress value={(step+1)/3*100}/><CardTitle className="pt-4 text-2xl">{t(`step${step+1}Title`)}</CardTitle><CardDescription>{t(`step${step+1}Description`)}</CardDescription></CardHeader><CardContent>{fields[step]}<div className="mt-8 flex justify-between"><Button variant="ghost" disabled={!hydrated||step===0||busy} onClick={()=>navigate(step-1)}><ArrowLeft className="size-4 rtl:rotate-180"/>{t("back")}</Button>{step<2?<Button disabled={!hydrated||busy||step===1&&!areas.some(area=>area.name.trim())} onClick={()=>navigate(step+1)}>{t("continue")}<ArrowRight className="size-4 rtl:rotate-180"/></Button>:<Button disabled={!hydrated||busy||!areas.some(area=>area.name.trim())} onClick={finish}><Check className="size-4"/>{t("finish")}</Button>}</div></CardContent></Card></main>;
}

function ChecklistEditor({item,t,patch,update}:{item:DraftItem;t:(key:string)=>string;patch:(item:DraftItem,index:number,value:string)=>void;update:(id:string,change:Partial<DraftItem>)=>void}){return <div className="mt-3 space-y-2"><Label>{t("checklist")}</Label>{item.checklist.map((value,index)=><div key={index} className="flex gap-2"><Input value={value} onChange={event=>patch(item,index,event.target.value)} placeholder={t("checklistPlaceholder")}/>{item.checklist.length>1&&<Button size="icon" variant="ghost" onClick={()=>update(item.clientId,{checklist:item.checklist.filter((_,candidate)=>candidate!==index)})}><Trash2 className="size-4"/></Button>}</div>)}<Button size="sm" variant="ghost" onClick={()=>update(item.clientId,{checklist:[...item.checklist,""]})}><Plus className="size-4"/>{t("addChecklist")}</Button></div>}
function Field({label,children}:{label:string;children:React.ReactNode}){return <div className="space-y-2"><Label>{label}</Label>{children}</div>}
function weekdayLong(day:Weekday,locale:string){return new Intl.DateTimeFormat(locale,{weekday:"long",timeZone:"UTC"}).format(new Date(Date.UTC(2024,0,7+day)))}
