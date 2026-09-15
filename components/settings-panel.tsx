"use client";

import {useEffect,useState} from "react";
import {LoaderCircle,Save} from "lucide-react";
import {useLocale,useTranslations} from "next-intl";
import {useRouter} from "next/navigation";
import {toast} from "sonner";
import type {Weekday} from "@/types/domain";
import {ApiClientError,apiFetch,getSettings} from "./api-client";
import {hasFieldError,ValidationFeedback} from "./validation-feedback";
import {Page} from "./weekly-plan";
import {Button} from "./ui/button";
import {Card,CardContent,CardHeader,CardTitle} from "./ui/card";
import {Input} from "./ui/input";
import {Label} from "./ui/label";
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from "./ui/select";

export function SettingsPanel(){
  const t=useTranslations("Settings");
  const locale=useLocale();
  const router=useRouter();
  const [language,setLanguage]=useState<"en"|"ar">(locale as "en"|"ar");
  const [timezone,setTimezone]=useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [weekStart,setWeekStart]=useState<Weekday>(6);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [timezoneError,setTimezoneError]=useState("");
  const v=useTranslations("Validation");

  useEffect(()=>{getSettings().then(settings=>{setLanguage(settings.locale);setTimezone(settings.timezone);setWeekStart(settings.weekStartsOn)}).catch(()=>toast.error(t("error"))).finally(()=>setLoading(false))},[t]);
  async function save(){setTimezoneError("");try{new Intl.DateTimeFormat("en",{timeZone:timezone}).format()}catch{setTimezoneError(v("timezone"));return}setBusy(true);try{await apiFetch("/api/v1/me/settings",{method:"PATCH",body:JSON.stringify({locale:language,timezone,weekStartsOn:weekStart})},()=>({}));toast.success(t("saved"));if(language!==locale)router.push(`/${language}/settings`)}catch(error){if(error instanceof ApiClientError&&hasFieldError(error.fieldErrors,"timezone"))setTimezoneError(v("timezone"));else toast.error(t("error"))}finally{setBusy(false)}}
  if(loading)return <Page title={t("title")}><div className="grid min-h-48 place-items-center"><LoaderCircle className="size-6 animate-spin"/></div></Page>;
  return <Page title={t("title")}><Card><CardHeader><CardTitle>{t("preferences")}</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="settings-language">{t("language")}</Label><select id="settings-language" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={language} onChange={event=>setLanguage(event.target.value as "en"|"ar")}><option value="en">English</option><option value="ar">العربية</option></select></div><div className="space-y-2"><Label htmlFor="settings-timezone">{t("timezone")}</Label><Input id="settings-timezone" value={timezone} onChange={event=>{setTimezone(event.target.value);setTimezoneError("")}} aria-invalid={!!timezoneError} aria-describedby={timezoneError?"settings-timezone-error":undefined}/><ValidationFeedback id="settings-timezone-error" message={timezoneError}/></div><div className="space-y-2"><Label htmlFor="settings-week-start">{t("weekStart")}</Label><select id="settings-week-start" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={weekStart} onChange={event=>setWeekStart(Number(event.target.value) as Weekday)}>{[0,1,2,3,4,5,6].map(day=><option key={day} value={day}>{weekdayLong(day as Weekday,locale)}</option>)}</select></div><div className="flex items-end"><Button disabled={busy} onClick={save}><Save className="size-4"/>{t("save")}</Button></div></CardContent></Card></Page>}

function weekdayLong(day:Weekday,locale:string){return new Intl.DateTimeFormat(locale,{weekday:"long",timeZone:"UTC"}).format(new Date(Date.UTC(2024,0,7+day)))}
