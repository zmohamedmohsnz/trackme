"use client";

import {useEffect,useState} from "react";
import {LoaderCircle,Save} from "lucide-react";
import {useLocale,useTranslations} from "next-intl";
import {toast} from "sonner";
import type {FocusItem,IsoDate,Weekday,WeeklyPlanEntry} from "@/types/domain";
import {latestPlanForDate} from "@/lib/domain/schedule";
import {isIsoDate,todayInTimeZone} from "@/lib/domain/dates";
import {ApiClientError,apiFetch,getFocusItems,getSettings,getWeeklyPlan} from "./api-client";
import {hasFieldError,ValidationFeedback} from "./validation-feedback";
import {Button} from "./ui/button";
import {Card,CardContent,CardHeader,CardTitle} from "./ui/card";
import {Input} from "./ui/input";
import {Label} from "./ui/label";

type ItemPlan=Partial<Record<Weekday,number>>;

export function WeeklyPlan(){
  const t=useTranslations("Plan");
  const locale=useLocale();
  const [items,setItems]=useState<FocusItem[]>([]);
  const [plans,setPlans]=useState<Record<string,ItemPlan>>({});
  const [effective,setEffective]=useState(new Date().toISOString().slice(0,10) as IsoDate);
  const [weekStart,setWeekStart]=useState<Weekday>(6);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [fieldErrors,setFieldErrors]=useState<Record<string,string>>({});
  const v=useTranslations("Validation");

  useEffect(()=>{Promise.all([getFocusItems(),getWeeklyPlan(),getSettings()]).then(([focusItems,versions,settings])=>{
    setItems(focusItems);
    setWeekStart(settings.weekStartsOn);
    const localToday=todayInTimeZone(settings.timezone);
    setEffective(currentEffective=>currentEffective===new Date().toISOString().slice(0,10)?localToday:currentEffective);
    const current=latestPlanForDate(versions,effective);
    const next:Record<string,ItemPlan>={};
    for(const item of focusItems){const entries=current?.entries.filter(entry=>entry.itemId===item.id)??[];next[item.id]=Object.fromEntries(entries.map(entry=>[entry.weekday,entry.durationMinutes])) as ItemPlan}
    setPlans(next);
  }).catch(()=>toast.error(t("error"))).finally(()=>setLoading(false))},[effective,t]);

  function toggleDay(itemId:string,weekday:Weekday){setPlans(current=>{const plan={...(current[itemId]??{})};if(plan[weekday]===undefined)plan[weekday]=60;else delete plan[weekday];return {...current,[itemId]:plan}})}
  function setDuration(itemId:string,weekday:Weekday,durationMinutes:number){setPlans(current=>({...current,[itemId]:{...(current[itemId]??{}),[weekday]:durationMinutes}}))}
  async function save(){const entryKeys:string[]=[];const entries:WeeklyPlanEntry[]=items.flatMap(item=>Object.entries(plans[item.id]??{}).map(([weekday,durationMinutes])=>{entryKeys.push(`${item.id}-${weekday}`);return {itemId:item.id,weekday:Number(weekday) as Weekday,durationMinutes}}));const next:Record<string,string>={};if(!isIsoDate(effective))next.effectiveFrom=v("date");entries.forEach((entry,index)=>{if(!Number.isInteger(entry.durationMinutes)||entry.durationMinutes<1||entry.durationMinutes>1440)next[entryKeys[index]]=v("duration")});setFieldErrors(next);if(Object.keys(next).length)return;setBusy(true);try{await apiFetch("/api/v1/weekly-plan",{method:"PUT",body:JSON.stringify({effectiveFrom:effective,entries})},()=>({}));toast.success(t("saved"))}catch(error){if(error instanceof ApiClientError){const apiErrors:Record<string,string>={};if(hasFieldError(error.fieldErrors,"effectiveFrom"))apiErrors.effectiveFrom=v("date");entryKeys.forEach((key,index)=>{if(hasFieldError(error.fieldErrors,`entries.${index}.durationMinutes`,`entries.${index}`))apiErrors[key]=v("duration")});if(Object.keys(apiErrors).length){setFieldErrors(apiErrors);return}}toast.error(t("error"))}finally{setBusy(false)}}

  const weekdays=Array.from({length:7},(_,index)=>((weekStart+index)%7) as Weekday);
  if(loading)return <Page title={t("title")} description={t("description")}><div className="grid min-h-48 place-items-center"><LoaderCircle className="size-6 animate-spin"/></div></Page>;
  return <Page title={t("title")} description={t("description")}><div className="space-y-4"><Card><CardContent className="pt-6"><div className="max-w-xs space-y-2"><Label htmlFor="plan-effective-from">{t("effectiveFrom")}</Label><Input id="plan-effective-from" type="date" value={effective} onChange={event=>{setEffective(event.target.value as IsoDate);setFieldErrors(current=>({...current,effectiveFrom:""}))}} aria-invalid={!!fieldErrors.effectiveFrom} aria-describedby={fieldErrors.effectiveFrom?"plan-effective-from-error":undefined}/><ValidationFeedback id="plan-effective-from-error" message={fieldErrors.effectiveFrom}/></div></CardContent></Card>{items.length?items.map(item=>{const plan=plans[item.id]??{};return <Card key={item.id}><CardHeader><CardTitle className="text-base">{item.name}<span className="ms-2 text-xs font-normal text-muted-foreground">{t(item.kind)}</span></CardTitle></CardHeader><CardContent><Label>{t("days")}</Label><div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">{weekdays.map(day=>{const active=plan[day]!==undefined;const key=`${item.id}-${day}`;return <div key={day} className={`rounded-md border p-2 ${active?"bg-accent":"bg-background"}`}><button type="button" onClick={()=>toggleDay(item.id,day)} className="w-full text-xs font-medium" aria-pressed={active}>{weekdayLabel(day,locale)}</button>{active&&<div className="mt-2 space-y-1"><Label className="text-xs" htmlFor={key}>{t("target")}</Label><Input id={key} aria-label={`${weekdayLabel(day,locale)} ${t("target")}`} type="number" min="1" max="1440" value={plan[day]} onChange={event=>{setDuration(item.id,day,Number(event.target.value));setFieldErrors(current=>({...current,[key]:""}))}} aria-invalid={!!fieldErrors[key]} aria-describedby={fieldErrors[key]?`${key}-error`:undefined}/><ValidationFeedback id={`${key}-error`} message={fieldErrors[key]}/></div>}</div>})}</div></CardContent></Card>}):<Card><CardContent className="pt-6 text-sm text-muted-foreground">{t("noItems")}</CardContent></Card>}<Button disabled={busy||!items.length} onClick={save}><Save className="size-4"/>{t("save")}</Button></div></Page>}

function weekdayLabel(day:Weekday,locale:string){return new Intl.DateTimeFormat(locale,{weekday:"short",timeZone:"UTC"}).format(new Date(Date.UTC(2024,0,7+day)))}
export function Page({title,description,children}:{title:string;description?:string;children:React.ReactNode}){return <div className="mx-auto max-w-4xl p-4 sm:p-6"><header className="mb-6"><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>{description?<p className="mt-1 text-sm text-muted-foreground">{description}</p>:null}</header>{children}</div>}
