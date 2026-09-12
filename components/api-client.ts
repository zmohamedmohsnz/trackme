"use client";
import type {CalendarDay, FocusItem, UserSettings, WeeklyPlanVersion} from "@/types/domain";
import {demoCalendar, demoFocusItems, demoSettings, demoWeeklyPlan} from "./demo-data";

export const demoMode=!process.env.NEXT_PUBLIC_SUPABASE_URL||!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export async function apiFetch<T>(path:string,init?:RequestInit,fallback?:()=>T):Promise<T>{
  if(demoMode&&fallback)return fallback();
  const response=await fetch(path,{...init,credentials:"include",headers:{"Content-Type":"application/json",...init?.headers}});
  if(!response.ok){const body=await response.json().catch(()=>null);throw new Error(body?.error?.message||`Request failed (${response.status})`)}
  if(response.status===204)return undefined as T;
  const body=await response.json() as {data:T};
  return body.data;
}
export async function getCalendar(from:string,to:string){return apiFetch<CalendarDay[]>(`/api/v1/calendar?from=${from}&to=${to}`,undefined,()=>demoCalendar(from,to))}
export async function getFocusItems(includeArchived=false){return apiFetch<FocusItem[]>(`/api/v1/focus-items${includeArchived?"?includeArchived=true":""}`,undefined,()=>demoFocusItems.filter(item=>includeArchived||!item.archivedAt))}
export async function getWeeklyPlan(){return apiFetch<WeeklyPlanVersion[]>("/api/v1/weekly-plan",undefined,()=>demoWeeklyPlan)}
export async function getSettings(){return apiFetch<UserSettings>("/api/v1/me/settings",undefined,()=>demoSettings)}
