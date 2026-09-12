"use client";

import {useEffect,useState} from "react";
import {ArchiveRestore,LoaderCircle,Save} from "lucide-react";
import {useLocale,useTranslations} from "next-intl";
import {useRouter} from "next/navigation";
import {toast} from "sonner";
import type {FocusItem,Weekday} from "@/types/domain";
import {apiFetch,getFocusItems,getSettings} from "./api-client";
import {Page} from "./weekly-plan";
import {Button} from "./ui/button";
import {Card,CardContent,CardDescription,CardHeader,CardTitle} from "./ui/card";
import {Input} from "./ui/input";
import {Label} from "./ui/label";

export function SettingsPanel(){
  const t=useTranslations("Settings");
  const locale=useLocale();
  const router=useRouter();
  const [language,setLanguage]=useState<"en"|"ar">(locale as "en"|"ar");
  const [timezone,setTimezone]=useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [weekStart,setWeekStart]=useState<Weekday>(6);
  const [archived,setArchived]=useState<FocusItem[]>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);

  useEffect(()=>{Promise.all([getSettings(),getFocusItems(true)]).then(([settings,items])=>{setLanguage(settings.locale);setTimezone(settings.timezone);setWeekStart(settings.weekStartsOn);setArchived(items.filter(item=>!!item.archivedAt))}).catch(error=>toast.error(error instanceof Error?error.message:t("error"))).finally(()=>setLoading(false))},[t]);
  async function save(){setBusy(true);try{await apiFetch("/api/v1/me/settings",{method:"PATCH",body:JSON.stringify({locale:language,timezone,weekStartsOn:weekStart})},()=>({}));toast.success(t("saved"));if(language!==locale)router.push(`/${language}/settings`)}catch(error){toast.error(error instanceof Error?error.message:t("error"))}finally{setBusy(false)}}
  async function restore(item:FocusItem){setBusy(true);try{const restored=await apiFetch<FocusItem>("/api/v1/focus-items",{method:"PATCH",body:JSON.stringify({id:item.id,archived:false})},()=>({...item,archivedAt:null}));setArchived(current=>current.filter(candidate=>candidate.id!==restored.id));toast.success(t("restored"))}catch(error){toast.error(error instanceof Error?error.message:t("error"))}finally{setBusy(false)}}
  if(loading)return <Page title={t("title")} description={t("description")}><div className="grid min-h-48 place-items-center"><LoaderCircle className="size-6 animate-spin"/></div></Page>;
  return <Page title={t("title")} description={t("description")}><div className="space-y-5"><Card><CardHeader><CardTitle>{t("preferences")}</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>{t("language")}</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={language} onChange={event=>setLanguage(event.target.value as "en"|"ar")}><option value="en">English</option><option value="ar">العربية</option></select></div><div className="space-y-2"><Label>{t("timezone")}</Label><Input value={timezone} onChange={event=>setTimezone(event.target.value)}/></div><div className="space-y-2"><Label>{t("weekStart")}</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={weekStart} onChange={event=>setWeekStart(Number(event.target.value) as Weekday)}>{[0,1,2,3,4,5,6].map(day=><option key={day} value={day}>{weekdayLong(day as Weekday,locale)}</option>)}</select></div><div className="flex items-end"><Button disabled={busy} onClick={save}><Save className="size-4"/>{t("save")}</Button></div></CardContent></Card><Card><CardHeader><CardTitle>{t("archived")}</CardTitle><CardDescription>{t("archivedDescription")}</CardDescription></CardHeader><CardContent>{archived.length?<ul className="divide-y">{archived.map(item=><li key={item.id} className="flex items-center justify-between py-3 text-sm"><span>{item.name}</span><Button disabled={busy} size="sm" variant="outline" onClick={()=>restore(item)}><ArchiveRestore className="size-4"/>{t("restore")}</Button></li>)}</ul>:<p className="text-sm text-muted-foreground">{t("noneArchived")}</p>}</CardContent></Card></div></Page>}

function weekdayLong(day:Weekday,locale:string){return new Intl.DateTimeFormat(locale,{weekday:"long",timeZone:"UTC"}).format(new Date(Date.UTC(2024,0,7+day)))}
