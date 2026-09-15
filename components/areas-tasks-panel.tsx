"use client";

import {useEffect,useState} from "react";
import {LoaderCircle} from "lucide-react";
import {useTranslations} from "next-intl";
import {toast} from "sonner";
import {getSettings} from "./api-client";
import {FocusItemManager} from "./focus-item-manager";
import {Page} from "./weekly-plan";

export function AreasTasksPanel(){
  const t=useTranslations("AreasTasks");
  const [timezone,setTimezone]=useState<string>();

  useEffect(()=>{getSettings().then(settings=>setTimezone(settings.timezone)).catch(()=>toast.error(t("error")))},[t]);

  return <Page title={t("title")} description={t("description")}>
    {timezone?<FocusItemManager timezone={timezone}/>:<div className="grid min-h-48 place-items-center"><LoaderCircle className="size-6 animate-spin"/></div>}
  </Page>;
}
