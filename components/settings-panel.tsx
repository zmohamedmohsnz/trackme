"use client";

import {useEffect,useState} from "react";
import {LoaderCircle,Save} from "lucide-react";
import {useLocale,useTranslations} from "next-intl";
import {useRouter} from "next/navigation";
import {toast} from "sonner";
import type {Weekday} from "@/types/domain";
import {ApiClientError,apiFetch,getSettings} from "./api-client";
import {hasFieldError,ValidationFeedback} from "./validation-feedback";
import {FocusItemManager} from "./focus-item-manager";
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
  if(loading)return <Page title={t("title")} description={t("description")}><div className="grid min-h-48 place-items-center"><LoaderCircle className="size-6 animate-spin"/></div></Page>;
  return <Page title={t("title")} description={t("description")}><div className="space-y-5"><Card><CardHeader><CardTitle>{t("preferences")}</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="settings-language">{t("language")}</Label><Select value={language} onValueChange={value=>setLanguage(value as "en"|"ar")}><SelectTrigger id="settings-language"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="en">English</SelectItem><SelectItem value="ar">العربية</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label htmlFor="settings-timezone">{t("timezone")}</Label><Input id="settings-timezone" value={timezone} onChange={event=>{setTimezone(event.target.value);setTimezoneError("")}} aria-invalid={!!timezoneError} aria-describedby={timezoneError?"settings-timezone-error":undefined}/><ValidationFeedback id="settings-timezone-error" message={timezoneError}/></div><div className="space-y-2"><Label htmlFor="settings-week-start">{t("weekStart")}</Label><Select value={String(weekStart)} onValueChange={value=>setWeekStart(Number(value) as Weekday)}><SelectTrigger id="settings-week-start"><SelectValue/></SelectTrigger><SelectContent>{[0,1,2,3,4,5,6].map(day=><SelectItem key={day} value={String(day)}>{weekdayLong(day as Weekday,locale)}</SelectItem>)}</SelectContent></Select></div><div className="flex items-end"><Button disabled={busy} onClick={save}><Save className="size-4"/>{t("save")}</Button></div></CardContent></Card><FocusItemManager timezone={timezone}/></div></Page>}

function weekdayLong(day:Weekday,locale:string){return new Intl.DateTimeFormat(locale,{weekday:"long",timeZone:"UTC"}).format(new Date(Date.UTC(2024,0,7+day)))}
