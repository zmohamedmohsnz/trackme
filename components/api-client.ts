"use client";
import {demoCalendar} from "./demo-data";

export const demoMode=!process.env.NEXT_PUBLIC_SUPABASE_URL||!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export async function apiFetch<T>(path:string,init?:RequestInit,fallback?:()=>T):Promise<T>{
  if(demoMode&&fallback)return fallback();
  const response=await fetch(path,{...init,headers:{"Content-Type":"application/json",...init?.headers}});
  if(!response.ok){const body=await response.json().catch(()=>null);throw new Error(body?.error?.message||`Request failed (${response.status})`)}
  return response.json();
}
export async function getCalendar(from:string,to:string){return apiFetch(`/api/v1/calendar?from=${from}&to=${to}`,undefined,()=>demoCalendar(from,to))}
