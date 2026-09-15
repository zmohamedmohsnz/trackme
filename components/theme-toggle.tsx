"use client";

import {Moon,Sun} from "lucide-react";
import {useLayoutEffect,useSyncExternalStore} from "react";
import {useTranslations} from "next-intl";
import {THEME_STORAGE_KEY,type Theme} from "@/lib/theme";
import {Button} from "./ui/button";

function getAppliedTheme():Theme{
  return document.documentElement.classList.contains("dark")?"dark":"light";
}

function applyTheme(theme:Theme){
  document.documentElement.classList.toggle("dark",theme==="dark");
}

const THEME_CHANGE_EVENT="trackme-theme-change";

function subscribeToTheme(onStoreChange:()=>void){
  function handleStorage(event:StorageEvent){
    if(event.key!==THEME_STORAGE_KEY)return;
    applyTheme(event.newValue==="dark"?"dark":"light");
    onStoreChange();
  }

  window.addEventListener("storage",handleStorage);
  window.addEventListener(THEME_CHANGE_EVENT,onStoreChange);
  return ()=>{
    window.removeEventListener("storage",handleStorage);
    window.removeEventListener(THEME_CHANGE_EVENT,onStoreChange);
  };
}

function isDarkTheme(){
  return getAppliedTheme()==="dark";
}

export function ThemeToggle({className}:{className?:string}){
  const t=useTranslations("Nav");
  const isDark=useSyncExternalStore(subscribeToTheme,isDarkTheme,()=>false);

  useLayoutEffect(()=>{
    let storedTheme:Theme="light";
    try{storedTheme=localStorage.getItem(THEME_STORAGE_KEY)==="dark"?"dark":"light"}catch{}
    applyTheme(storedTheme);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  },[]);

  function toggleTheme(){
    const nextTheme:Theme=getAppliedTheme()==="dark"?"light":"dark";
    applyTheme(nextTheme);
    try{localStorage.setItem(THEME_STORAGE_KEY,nextTheme)}catch{}
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }

  return <Button type="button" variant="ghost" className={className} aria-label={t("theme")} aria-pressed={isDark} onClick={toggleTheme}>
    <Moon className="size-4 dark:hidden" aria-hidden="true"/>
    <Sun className="hidden size-4 dark:block" aria-hidden="true"/>
    <span>{t("theme")}</span>
  </Button>;
}
