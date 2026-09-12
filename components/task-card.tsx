"use client";

import {useState} from "react";
import {Check, CornerDownRight, RotateCcw, Timer} from "lucide-react";
import {useTranslations} from "next-intl";
import {toast} from "sonner";
import type {CalendarItem, CompletionAction, TimeEntry} from "@/types/domain";
import {apiFetch, demoMode, getCalendar} from "./api-client";
import {Badge} from "./ui/badge";
import {Button} from "./ui/button";
import {Input} from "./ui/input";
import {Progress} from "./ui/progress";

export function TaskCard({item,date,compact=false,onChange}:{item:CalendarItem;date:string;compact?:boolean;onChange?:(next:CalendarItem)=>void}) {
  const t=useTranslations("Calendar");
  const [minutes,setMinutes]=useState("");
  const [busy,setBusy]=useState(false);

  async function applyCanonical(fallback: CalendarItem) {
    if (demoMode) return onChange?.(fallback);
    const [day] = await getCalendar(date,date);
    const canonical = day?.items.find(candidate=>candidate.item.id===item.item.id);
    if (canonical) onChange?.(canonical);
  }

  async function addTime(event:React.FormEvent) {
    event.preventDefault();
    const value=Number(minutes);
    if(!Number.isInteger(value)||value<1||value>1440)return;
    setBusy(true);
    try {
      await apiFetch<TimeEntry>("/api/v1/time-entries",{method:"POST",body:JSON.stringify({itemId:item.item.id,date,minutes:value})},()=>({id:crypto.randomUUID(),itemId:item.item.id,date:date as TimeEntry["date"],minutes:value,source:"manual"}));
      const directMinutes=item.directMinutes+value;
      const actualMinutes=directMinutes+item.contributedMinutes;
      await applyCanonical({...item,directMinutes,actualMinutes,percent:Math.min(100,actualMinutes/item.targetMinutes*100),complete:actualMinutes>=item.targetMinutes&&item.checklist.every(step=>step.completed)});
      setMinutes("");
      toast.success(t("timeAdded"));
    } catch(error) {
      toast.error(error instanceof Error?error.message:t("error"));
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
    } catch(error) {
      toast.error(error instanceof Error?error.message:t("error"));
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
        await applyCanonical({...item,completionActionId:undefined,completionFilledMinutes:undefined,directMinutes,actualMinutes,percent:Math.min(100,actualMinutes/item.targetMinutes*100),complete:false,checklist:item.checklist.map(step=>({...step,completed:false}))});
        toast.success(t("undone"));
      } else {
        const action=await apiFetch<CompletionAction>("/api/v1/completion-actions",{method:"POST",body:JSON.stringify({itemId:item.item.id,date,idempotencyKey:crypto.randomUUID()})},()=>({id:crypto.randomUUID(),itemId:item.item.id,date:date as CompletionAction["date"],idempotencyKey:crypto.randomUUID(),targetMinutes:item.targetMinutes,progressMinutesBefore:item.actualMinutes,filledMinutes:Math.max(0,item.targetMinutes-item.actualMinutes)}));
        const directMinutes=item.directMinutes+action.filledMinutes;
        const actualMinutes=directMinutes+item.contributedMinutes;
        await applyCanonical({...item,completionActionId:action.id,completionFilledMinutes:action.filledMinutes,directMinutes,actualMinutes,percent:Math.min(100,actualMinutes/item.targetMinutes*100),complete:true,checklist:item.checklist.map(step=>({...step,completed:true}))});
        toast.success(t("completed"));
      }
    } catch(error) {
      toast.error(error instanceof Error?error.message:t("error"));
    } finally {
      setBusy(false);
    }
  }

  return <article className="rounded-lg border bg-card p-3 shadow-sm" data-testid="task-card">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">{item.item.kind==="subtask"&&<CornerDownRight className="size-3.5 text-muted-foreground"/>}<h3 className="truncate text-sm font-semibold">{item.item.name}</h3></div>
      </div>
      {item.complete&&<Badge><Check className="me-1 size-3"/>{t("done")}</Badge>}
    </div>
    <div className="mt-3 flex items-end justify-between gap-3 text-xs"><span className="font-medium tabular-nums">{formatDuration(item.actualMinutes)} / {formatDuration(item.targetMinutes)}</span><span className="text-muted-foreground">{Math.round(item.percent)}%</span></div>
    <Progress value={item.percent} className="mt-1.5"/>
    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground"><span>{t("direct")}: {formatDuration(item.directMinutes)}</span>{item.contributedMinutes>0&&<span>{t("contributed")}: {formatDuration(item.contributedMinutes)}</span>}{item.checklist.length>0&&<span>{t("checklist")}: {item.checklist.filter(step=>step.completed).length}/{item.checklist.length}</span>}</div>
    {!compact&&<>
      <ul className="mt-3 space-y-1 text-xs">{item.checklist.map(step=><li key={step.id}><button type="button" disabled={busy} onClick={()=>toggleChecklist(step.id,step.completed)} className="flex w-full items-center gap-2 text-start text-muted-foreground"><span className={`grid size-4 place-items-center rounded border ${step.completed?"bg-primary text-primary-foreground":""}`}>{step.completed&&<Check className="size-3"/>}</span><span className={step.completed?"line-through":""}>{step.label}</span></button></li>)}</ul>
      <form onSubmit={addTime} className="mt-3 flex gap-2"><div className="relative min-w-0 flex-1"><Timer className="absolute start-2.5 top-2.5 size-3.5 text-muted-foreground"/><Input aria-label={t("minutes")} className="h-8 ps-8 text-xs" type="number" min="1" max="1440" value={minutes} onChange={event=>setMinutes(event.target.value)} placeholder={t("minutes")}/></div><Button size="sm" variant="outline" disabled={busy}>{t("add")}</Button></form>
      <Button size="sm" variant={item.completionActionId?"ghost":"secondary"} className="mt-2 w-full" onClick={toggleCompletion} disabled={busy}>{item.completionActionId?<><RotateCcw className="size-3.5"/>{t("undo")}</>:<><Check className="size-3.5"/>{t("markComplete")}</>}</Button>
    </>}
  </article>;
}

export function formatDuration(minutes:number){const h=Math.floor(minutes/60),m=minutes%60;return h?`${h}h${m?` ${m}m`:""}`:`${m}m`}
