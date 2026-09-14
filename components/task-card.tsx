"use client";

import {useRef,useState} from "react";
import {Check, CornerDownRight, History, RotateCcw, Timer, Trash2} from "lucide-react";
import {useLocale,useTranslations} from "next-intl";
import {toast} from "sonner";
import type {CalendarDay, CalendarItem, CompletionAction, TimeEntry} from "@/types/domain";
import {ApiClientError,apiFetch, demoMode, getCalendar} from "./api-client";
import {hasFieldError,ValidationFeedback} from "./validation-feedback";
import {Badge} from "./ui/badge";
import {Button} from "./ui/button";
import {Dialog,DialogClose,DialogContent,DialogDescription,DialogFooter,DialogHeader,DialogTitle} from "./ui/dialog";
import {Input} from "./ui/input";
import {Progress} from "./ui/progress";

export function TaskCard({item,date,compact=false,timeZone,onChange,onDayChange}:{item:CalendarItem;date:string;compact?:boolean;timeZone?:string;onChange?:(next:CalendarItem)=>void;onDayChange?:(day:CalendarDay)=>void}) {
  const t=useTranslations("Calendar");
  const v=useTranslations("Validation");
  const locale=useLocale();
  const numberLocale=locale==="ar"?"ar-u-nu-arab":locale;
  const [minutes,setMinutes]=useState("");
  const [busy,setBusy]=useState(false);
  const [entryToDelete,setEntryToDelete]=useState<TimeEntry|null>(null);
  const [minutesError,setMinutesError]=useState("");
  const checklistBeforeCompletion=useRef<CalendarItem["checklist"]|null>(null);

  async function applyCanonical(fallback: CalendarItem) {
    if (demoMode) return onChange?.(fallback);
    const [day] = await getCalendar(date,date);
    if (day && onDayChange) return onDayChange(day);
    const canonical = day?.items.find(candidate=>candidate.item.id===item.item.id);
    if (canonical) onChange?.(canonical);
  }

  async function addTime(event:React.FormEvent) {
    event.preventDefault();
    const value=Number(minutes);
    setMinutesError("");
    if(!Number.isInteger(value)||value<1||value>1440){setMinutesError(v("duration"));return}
    setBusy(true);
    try {
      const entry=await apiFetch<TimeEntry>("/api/v1/time-entries",{method:"POST",body:JSON.stringify({itemId:item.item.id,date,minutes:value})},()=>({id:crypto.randomUUID(),itemId:item.item.id,date:date as TimeEntry["date"],minutes:value,source:"manual",createdAt:new Date().toISOString()}));
      const directMinutes=item.directMinutes+value;
      const actualMinutes=directMinutes+item.contributedMinutes;
      await applyCanonical({...item,directMinutes,actualMinutes,remainingMinutes:Math.max(0,item.targetMinutes-actualMinutes),percent:Math.min(100,actualMinutes/item.targetMinutes*100),complete:actualMinutes>=item.targetMinutes&&item.checklist.every(step=>step.completed),manualEntries:[entry,...item.manualEntries]});
      setMinutes("");
      toast.success(t("timeAdded"));
    } catch (error) {
      if(error instanceof ApiClientError&&hasFieldError(error.fieldErrors,"minutes"))setMinutesError(v("duration"));
      else toast.error(t("error"));
    } finally {
      setBusy(false);
    }
  }

  async function toggleChecklist(stepId:string,completed:boolean) {
    setBusy(true);
    try {
      await apiFetch(`/api/v1/checklist-completions/${date}/${stepId}`,{method:completed?"DELETE":"PUT"},()=>({}));
      const checklist=item.checklist.map(step=>step.id===stepId?{...step,completed:!completed}:step);
      await applyCanonical({...item,checklist,complete:item.actualMinutes>=item.targetMinutes&&checklist.every(step=>step.completed)});
    } catch {
      toast.error(t("error"));
    } finally {
      setBusy(false);
    }
  }

  async function deleteManualEntry() {
    if(!entryToDelete)return;
    setBusy(true);
    try {
      await apiFetch<void>("/api/v1/time-entries",{method:"DELETE",body:JSON.stringify({id:entryToDelete.id})},()=>undefined);
      const directMinutes=Math.max(0,item.directMinutes-entryToDelete.minutes);
      const actualMinutes=directMinutes+item.contributedMinutes;
      await applyCanonical({...item,directMinutes,actualMinutes,remainingMinutes:Math.max(0,item.targetMinutes-actualMinutes),percent:item.targetMinutes>0?Math.min(100,actualMinutes/item.targetMinutes*100):0,complete:actualMinutes>=item.targetMinutes&&item.checklist.every(step=>step.completed),manualEntries:item.manualEntries.filter(entry=>entry.id!==entryToDelete.id)});
      setEntryToDelete(null);
      toast.success(t("timeDeleted"));
    } catch {
      toast.error(t("timeDeleteError"));
    } finally {
      setBusy(false);
    }
  }

  async function toggleCompletion() {
    setBusy(true);
    try {
      if(item.completionActionId) {
        await apiFetch<boolean>(`/api/v1/completion-actions/${item.completionActionId}`,{method:"DELETE"},()=>true);
        const filled=item.completionFilledMinutes??0;
        const directMinutes=Math.max(0,item.directMinutes-filled);
        const actualMinutes=directMinutes+item.contributedMinutes;
        await applyCanonical({...item,completionActionId:undefined,completionFilledMinutes:undefined,directMinutes,actualMinutes,remainingMinutes:Math.max(0,item.targetMinutes-actualMinutes),percent:Math.min(100,actualMinutes/item.targetMinutes*100),complete:false,checklist:checklistBeforeCompletion.current??item.checklist});
        checklistBeforeCompletion.current=null;
        toast.success(t("undone"));
      } else {
        checklistBeforeCompletion.current=item.checklist.map(step=>({...step}));
        const action=await apiFetch<CompletionAction>("/api/v1/completion-actions",{method:"POST",body:JSON.stringify({itemId:item.item.id,date,idempotencyKey:crypto.randomUUID()})},()=>({id:crypto.randomUUID(),itemId:item.item.id,date:date as CompletionAction["date"],idempotencyKey:crypto.randomUUID(),targetMinutes:item.targetMinutes,progressMinutesBefore:item.actualMinutes,filledMinutes:Math.max(0,item.targetMinutes-item.actualMinutes)}));
        const directMinutes=item.directMinutes+action.filledMinutes;
        const actualMinutes=directMinutes+item.contributedMinutes;
        await applyCanonical({...item,completionActionId:action.id,completionFilledMinutes:action.filledMinutes,directMinutes,actualMinutes,remainingMinutes:Math.max(0,item.targetMinutes-actualMinutes),percent:Math.min(100,actualMinutes/item.targetMinutes*100),complete:true,checklist:item.checklist.map(step=>({...step,completed:true}))});
        toast.success(t("completed"));
      }
    } catch {
      toast.error(t("error"));
    } finally {
      setBusy(false);
    }
  }

  return <div className="space-y-2"><article className="rounded-lg border bg-card p-3 shadow-sm" data-testid="task-card">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">{item.item.kind==="subtask"&&<CornerDownRight className="size-3.5 text-muted-foreground"/>}<h3 className="truncate text-sm font-semibold">{item.item.name}</h3></div>
      </div>
      {item.complete&&<Badge><Check className="me-1 size-3"/>{t("done")}</Badge>}
    </div>
    <div className="mt-3 flex items-end justify-between gap-3 text-xs"><span className="font-medium tabular-nums">{formatDuration(item.actualMinutes,numberLocale,t("hourShort"),t("minuteShort"))} / {formatDuration(item.targetMinutes,numberLocale,t("hourShort"),t("minuteShort"))}</span><span className="text-muted-foreground">{new Intl.NumberFormat(numberLocale,{style:"percent",maximumFractionDigits:0}).format(item.percent/100)}</span></div>
    <Progress value={item.percent} className="mt-1.5"/>
    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground"><span>{t("direct")}: {formatDuration(item.directMinutes,numberLocale,t("hourShort"),t("minuteShort"))}</span>{item.contributedMinutes>0&&<span>{t("contributed")}: {formatDuration(item.contributedMinutes,numberLocale,t("hourShort"),t("minuteShort"))}</span>}{item.checklist.length>0&&<span>{t("checklist")}: {new Intl.NumberFormat(numberLocale).format(item.checklist.filter(step=>step.completed).length)}/{new Intl.NumberFormat(numberLocale).format(item.checklist.length)}</span>}</div>
    {!compact&&<>
      <ul className="mt-3 space-y-1 text-xs">{item.checklist.map(step=><li key={step.id}><button type="button" disabled={busy||!!item.completionActionId} onClick={()=>toggleChecklist(step.id,step.completed)} className="flex w-full items-center gap-2 text-start text-muted-foreground disabled:cursor-not-allowed disabled:opacity-70"><span className={`grid size-4 place-items-center rounded border ${step.completed?"bg-primary text-primary-foreground":""}`}>{step.completed&&<Check className="size-3"/>}</span><span className={step.completed?"line-through":""}>{step.label}</span></button></li>)}</ul>
      <form noValidate onSubmit={addTime} className="mt-3 flex items-start gap-2"><div className="min-w-0 flex-1"><div className="relative"><Timer className="absolute start-2.5 top-2.5 size-3.5 text-muted-foreground"/><Input aria-label={t("minutes")} className="h-8 ps-8 text-xs" type="number" min="1" max="1440" value={minutes} onChange={event=>{setMinutes(event.target.value);setMinutesError("")}} placeholder={t("minutes")} aria-invalid={!!minutesError} aria-describedby={minutesError?`time-minutes-${item.item.id}-error`:undefined}/></div><ValidationFeedback id={`time-minutes-${item.item.id}-error`} message={minutesError}/></div><Button size="sm" variant="outline" disabled={busy}>{t("add")}</Button></form>
      {item.manualEntries.length>0&&<section className="mt-3 border-t pt-3" aria-label={t("manualHistory")}><h4 className="mb-2 flex items-center gap-1.5 text-xs font-medium"><History className="size-3.5"/>{t("manualHistory")}</h4><ul className="space-y-1.5">{item.manualEntries.map(entry=><li key={entry.id} className="flex items-center justify-between gap-3 rounded-md bg-muted/50 px-2.5 py-2 text-xs"><div><span className="font-medium">{formatDuration(entry.minutes,numberLocale,t("hourShort"),t("minuteShort"))}</span><time className="ms-2 text-muted-foreground" dateTime={entry.createdAt}>{formatEntryTimestamp(entry.createdAt,numberLocale,timeZone)}</time></div><Button type="button" size="icon" variant="ghost" className="size-7 shrink-0 text-destructive hover:text-destructive" aria-label={t("deleteTimeEntry",{duration:formatDuration(entry.minutes,numberLocale,t("hourShort"),t("minuteShort"))})} disabled={busy} onClick={()=>setEntryToDelete(entry)}><Trash2 className="size-3.5"/></Button></li>)}</ul></section>}
      <Button size="sm" variant={item.completionActionId?"ghost":"secondary"} className="mt-2 w-full" onClick={toggleCompletion} disabled={busy}>{item.completionActionId?<><RotateCcw className="size-3.5"/>{t("undo")}</>:<><Check className="size-3.5"/>{t("markComplete")}</>}</Button>
    </>}
  </article>{item.subtasks.length>0&&<div className="space-y-2 ps-3">{item.subtasks.map(subtask=><TaskCard key={subtask.item.id} item={subtask} date={date} compact={compact} timeZone={timeZone} onChange={onChange} onDayChange={onDayChange}/>)}</div>}<Dialog open={!!entryToDelete} onOpenChange={open=>{if(!open&&!busy)setEntryToDelete(null)}}><DialogContent><DialogHeader><DialogTitle>{t("deleteTimeTitle")}</DialogTitle><DialogDescription>{entryToDelete?t("deleteTimeDescription",{duration:formatDuration(entryToDelete.minutes,numberLocale,t("hourShort"),t("minuteShort"))}):""}</DialogDescription></DialogHeader><DialogFooter><DialogClose asChild><Button type="button" variant="outline" disabled={busy}>{t("cancel")}</Button></DialogClose><Button type="button" variant="destructive" disabled={busy} onClick={deleteManualEntry}>{t("delete")}</Button></DialogFooter></DialogContent></Dialog></div>;
}

export function formatDuration(minutes:number,locale="en",hourUnit="h",minuteUnit="m"){const resolvedLocale=locale==="ar"?"ar-u-nu-arab":locale;const number=new Intl.NumberFormat(resolvedLocale);const h=Math.floor(minutes/60),m=minutes%60;return h?`${number.format(h)}${hourUnit}${m?` ${number.format(m)}${minuteUnit}`:""}`:`${number.format(m)}${minuteUnit}`}
export function formatEntryTimestamp(value:string,locale="en",timeZone?:string){const resolvedLocale=locale==="ar"?"ar-u-nu-arab":locale;return new Intl.DateTimeFormat(resolvedLocale,{dateStyle:"medium",timeStyle:"short",...(timeZone?{timeZone}:{})}).format(new Date(value))}
