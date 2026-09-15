"use client";

import {useEffect,useState} from "react";
import {LoaderCircle} from "lucide-react";
import {useTranslations} from "next-intl";
import {toast} from "sonner";
import {FocusItemManager} from "./focus-item-manager";
import {getSettings} from "./api-client";
import {Page} from "./weekly-plan";

export function AreasPanel(){
  const t=useTranslations("Areas");
  const [timezone,setTimezone]=useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{getSettings().then(settings=>setTimezone(settings.timezone)).catch(()=>toast.error(t("error"))).finally(()=>setLoading(false))},[t]);

  if(loading)return <Page title={t("title")} description={t("description")}><div className="grid min-h-48 place-items-center"><LoaderCircle className="size-6 animate-spin"/></div></Page>;
  return <Page title={t("title")} description={t("description")}><FocusItemManager timezone={timezone}/></Page>;
}
