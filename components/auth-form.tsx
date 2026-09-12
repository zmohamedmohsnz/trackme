"use client";
import Link from "next/link";
import {useLocale,useTranslations} from "next-intl";
import {useRouter} from "next/navigation";
import {useState} from "react";
import {toast} from "sonner";
import {demoMode} from "./api-client";
import {Button} from "./ui/button";
import {Input} from "./ui/input";
import {Label} from "./ui/label";

type Mode="login"|"signup"|"forgot"|"reset";
export function AuthForm({mode}:{mode:Mode}){const t=useTranslations("Auth"),locale=useLocale(),router=useRouter();const [busy,setBusy]=useState(false);const [error,setError]=useState("");
 async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setError("");const data=new FormData(e.currentTarget),email=String(data.get("email")||""),password=String(data.get("password")||"");
  try{if(demoMode){toast.success(t("demoSuccess"));router.push(`/${locale}/${mode==="signup"?"onboarding":"calendar"}`);return}const {createClient}=await import("@/lib/supabase/client");const supabase=createClient();let result;
   if(mode==="login")result=await supabase.auth.signInWithPassword({email,password});else if(mode==="signup")result=await supabase.auth.signUp({email,password,options:{emailRedirectTo:`${location.origin}/${locale}/auth/callback`}});else if(mode==="forgot")result=await supabase.auth.resetPasswordForEmail(email,{redirectTo:`${location.origin}/${locale}/reset-password`});else result=await supabase.auth.updateUser({password});
   if(result.error)throw result.error;if(mode==="login"||mode==="reset")router.push(`/${locale}/calendar`);else router.push(`/${locale}/auth/result?kind=${mode}`);
  }catch(err){setError(err instanceof Error?err.message:t("unknownError"))}finally{setBusy(false)}}
 const title=t(`${mode}.title`),description=t(`${mode}.description`);
 return <form onSubmit={submit} className="space-y-4"><div><h1 className="text-2xl font-semibold tracking-tight">{title}</h1><p className="mt-2 text-sm text-muted-foreground">{description}</p></div>{mode!=="reset"&&<div className="space-y-2"><Label htmlFor="email">{t("email")}</Label><Input id="email" name="email" type="email" autoComplete="email" required placeholder="name@example.com"/></div>}{mode!=="forgot"&&<div className="space-y-2"><Label htmlFor="password">{t("password")}</Label><Input id="password" name="password" type="password" minLength={8} required autoComplete={mode==="login"?"current-password":"new-password"}/></div>}{error&&<p role="alert" className="text-sm text-destructive">{error}</p>}<Button disabled={busy} className="w-full">{busy?t("working"):t(`${mode}.submit`)}</Button><AuthLinks mode={mode} locale={locale} t={t}/></form>}
function AuthLinks({mode,locale,t}:{mode:Mode;locale:string;t:(key:string)=>string}){return <div className="space-y-2 text-center text-sm">{mode==="login"&&<><Link className="text-muted-foreground underline-offset-4 hover:underline" href={`/${locale}/forgot-password`}>{t("forgotLink")}</Link><p>{t("newHere")} <Link className="font-medium underline-offset-4 hover:underline" href={`/${locale}/signup`}>{t("signupLink")}</Link></p></>}{mode!=="login"&&<Link className="text-muted-foreground underline-offset-4 hover:underline" href={`/${locale}/login`}>{t("backLogin")}</Link>}</div>}
