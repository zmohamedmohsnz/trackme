"use client";

import {useEffect,useState} from "react";
import {LoaderCircle,Save} from "lucide-react";
import {useLocale,useTranslations} from "next-intl";
import {toast} from "sonner";
import type {FocusItem,IsoDate,Weekday,WeeklyPlanEntry} from "@/types/domain";
import {apiFetch,getFocusItems,getSettings,getWeeklyPlan} from "./api-client";
import {Button} from "./ui/button";
import {Card,CardContent,CardHeader,CardTitle} from "./ui/card";
import {Input} from "./ui/input";
import {Label} from "./ui/label";

type ItemPlan={durationMinutes:number;weekdays:Weekday[]};

export function WeeklyPlan(){
  const t=useTranslations("Plan");
  const locale=useLocale();
  const [items,setItems]=useState<FocusItem[]>([]);
  const [plans,setPlans]=useState<Record<string,ItemPlan>>({});
  const [effective,setEffective]=useState(new Date().toISOString().slice(0,10) as IsoDate);
  const [weekStart,setWeekStart]=useState<Weekday>(6);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);

  useEffect(()=>{Promise.all([getFocusItems(),getWeeklyPlan(),getSettings()]).then(([focusItems,versions,settings])=>{
    setItems(focusItems);
    setWeekStart(settings.weekStartsOn);
    const current=versions.find(version=>version.effectiveFrom<=effective)??versions[0];
    const next:Record<string,ItemPlan>={};
    for(const item of focusItems){const entries=current?.entries.filter(entry=>entry.itemId===item.id)??[];next[item.id]={durationMinutes:entries[0]?.durationMinutes??60,weekdays:entries.map(entry=>entry.weekday)}}
    setPlans(next);
  }).catch(error=>toast.error(error instanceof Error?error.message:t("error"))).finally(()=>setLoading(false))},[effective,t]);

  function patchPlan(itemId:string,change:Partial<ItemPlan>){setPlans(current=>({...current,[itemId]:{durationMinutes:current[itemId]?.durationMinutes??60,weekdays:current[itemId]?.weekdays??[],...change}}))}
  async function save(){setBusy(true);try{const entries:WeeklyPlanEntry[]=items.flatMap(item=>(plans[item.id]?.weekdays??[]).map(weekday=>({itemId:item.id,weekday,durationMinutes:plans[item.id].durationMinutes})));await apiFetch("/api/v1/weekly-plan",{method:"PUT",body:JSON.stringify({effectiveFrom:effective,entries})},()=>({}));toast.success(t("saved"))}catch(error){toast.error(error instanceof Error?error.message:t("error"))}finally{setBusy(false)}}

  const weekdays=Array.from({length:7},(_,index)=>((weekStart+index)%7) as Weekday);
  if(loading)return <Page title={t("title")} description={t("description")}><div className="grid min-h-48 place-items-center"><LoaderCircle className="size-6 animate-spin"/></div></Page>;
  return <Page title={t("title")} description={t("description")}><div className="space-y-4"><Card><CardContent className="pt-6"><div className="max-w-xs space-y-2"><Label>{t("effectiveFrom")}</Label><Input type="date" value={effective} onChange={event=>setEffective(event.target.value as IsoDate)}/></div></CardContent></Card>{items.length?items.map(item=>{const plan=plans[item.id]??{durationMinutes:60,weekdays:[]};return <Card key={item.id}><CardHeader><CardTitle className="text-base">{item.name}<span className="ms-2 text-xs font-normal text-muted-foreground">{t(item.kind)}</span></CardTitle></CardHeader><CardContent className="space-y-4"><div className="max-w-xs space-y-2"><Label>{t("target")}</Label><Input type="number" min="1" max="1440" value={plan.durationMinutes} onChange={event=>patchPlan(item.id,{durationMinutes:Number(event.target.value)})}/></div><div><Label>{t("days")}</Label><div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-7">{weekdays.map(day=><button type="button" key={day} onClick={()=>patchPlan(item.id,{weekdays:plan.weekdays.includes(day)?plan.weekdays.filter(value=>value!==day):[...plan.weekdays,day]})} className={`rounded-md border p-2 text-xs ${plan.weekdays.includes(day)?"bg-primary text-primary-foreground":""}`}>{weekdayLabel(day,locale)}</button>)}</div></div></CardContent></Card>}):<Card><CardContent className="pt-6 text-sm text-muted-foreground">{t("noItems")}</CardContent></Card>}<Button disabled={busy||!items.length} onClick={save}><Save className="size-4"/>{t("save")}</Button></div></Page>}

function weekdayLabel(day:Weekday,locale:string){return new Intl.DateTimeFormat(locale,{weekday:"short",timeZone:"UTC"}).format(new Date(Date.UTC(2024,0,7+day)))}
export function Page({title,description,children}:{title:string;description:string;children:React.ReactNode}){return <div className="mx-auto max-w-4xl p-4 sm:p-6"><header className="mb-6"><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1><p className="mt-1 text-sm text-muted-foreground">{description}</p></header>{children}</div>}
