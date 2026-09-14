"use client";

import {useEffect,useMemo,useState} from "react";
import {addDays,addMonths,endOfMonth,endOfWeek,format,startOfMonth,startOfWeek} from "date-fns";
import {arSA,enUS} from "date-fns/locale";
import {CalendarRange,ChevronLeft,ChevronRight,LoaderCircle,Rows3,Settings2,X} from "lucide-react";
import {useLocale,useTranslations} from "next-intl";
import {toast} from "sonner";
import type {CalendarDay,CalendarItem,FocusItem,IsoDate,Weekday,WeeklyPlanEntry} from "@/types/domain";
import {latestPlanForDate} from "@/lib/domain/schedule";
import {todayInTimeZone} from "@/lib/domain/dates";
import {ApiClientError,apiFetch,getCalendar,getFocusItems,getSettings,getWeeklyPlan} from "./api-client";
import {hasFieldError,ValidationFeedback} from "./validation-feedback";
import {TaskCard} from "./task-card";
import {Alert} from "./ui/alert";
import {Button} from "./ui/button";
import {Input} from "./ui/input";
import {Label} from "./ui/label";

type View="month"|"week";

export function CalendarDashboard() {
  const t=useTranslations("Calendar");
  const locale=useLocale();
  const dfLocale=locale==="ar"?arSA:enUS;
  const [view,setView]=useState<View>("month");
  const [anchor,setAnchor]=useState(new Date());
  const [days,setDays]=useState<CalendarDay[]>([]);
  const [focusItems,setFocusItems]=useState<FocusItem[]>([]);
  const [weekStartsOn,setWeekStartsOn]=useState<Weekday>(6);
  const [timeZone,setTimeZone]=useState<string>();
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [selected,setSelected]=useState<string|null>(null);
  const [requestKey,setRequestKey]=useState(0);
  const [todayIso,setTodayIso]=useState(format(new Date(),"yyyy-MM-dd"));

  useEffect(()=>{Promise.all([getSettings(),getFocusItems()]).then(([settings,items])=>{const today=todayInTimeZone(settings.timezone);setWeekStartsOn(settings.weekStartsOn);setTimeZone(settings.timezone);setTodayIso(today);setAnchor(new Date(`${today}T12:00:00`));setFocusItems(items)}).catch(()=>undefined)},[]);
  const range=useMemo(()=>view==="month"
    ?{start:startOfWeek(startOfMonth(anchor),{weekStartsOn}),end:endOfWeek(endOfMonth(anchor),{weekStartsOn})}
    :{start:startOfWeek(anchor,{weekStartsOn}),end:endOfWeek(anchor,{weekStartsOn})},[anchor,view,weekStartsOn]);
  const startIso=format(range.start,"yyyy-MM-dd"),endIso=format(range.end,"yyyy-MM-dd");

  useEffect(()=>{let active=true;getCalendar(startIso,endIso).then(result=>{if(active){setDays(result);setError("")}}).catch(()=>active&&setError(t("error"))).finally(()=>active&&setLoading(false));return()=>{active=false}},[startIso,endIso,requestKey,t]);

  function move(delta:number){setLoading(true);setAnchor(view==="month"?addMonths(anchor,delta):addDays(anchor,delta*7))}
  function update(date:string,next:CalendarItem){setDays(current=>current.map(day=>day.date===date?{...day,items:replaceCalendarItem(day.items,next)}:day))}
  function updateDay(next:CalendarDay){setDays(current=>current.map(day=>day.date===next.date?next:day))}
  function reload(){setLoading(true);setRequestKey(key=>key+1)}

  const byDate=new Map(days.map(day=>[day.date,day]));
  const gridDates=eachDay(range.start,range.end);
  const selectedDay=selected?byDate.get(selected as IsoDate):undefined;

  return <div className="mx-auto max-w-[1500px] p-4 sm:p-6">
    <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-sm text-muted-foreground">{t("eyebrow")}</p><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{view==="month"?format(anchor,"LLLL yyyy",{locale:dfLocale}):t("weekOf",{date:format(range.start,"PP",{locale:dfLocale})})}</h1></div>
      <div className="flex items-center gap-2"><div className="flex rounded-lg border bg-background p-1"><Button aria-label={t("month")} size="sm" variant={view==="month"?"secondary":"ghost"} onClick={()=>{setLoading(true);setView("month")}}><CalendarRange className="size-4"/><span className="hidden sm:inline">{t("month")}</span></Button><Button aria-label={t("week")} size="sm" variant={view==="week"?"secondary":"ghost"} onClick={()=>{setLoading(true);setView("week")}}><Rows3 className="size-4"/><span className="hidden sm:inline">{t("week")}</span></Button></div><Button size="icon" variant="outline" aria-label={t("previous")} onClick={()=>move(-1)}><ChevronLeft className="size-4 rtl:rotate-180"/></Button><Button size="icon" variant="outline" aria-label={t("next")} onClick={()=>move(1)}><ChevronRight className="size-4 rtl:rotate-180"/></Button></div>
    </header>
    {loading
      ? <div className="grid min-h-64 place-items-center"><LoaderCircle className="size-7 animate-spin text-muted-foreground"/></div>
      : error
        ? <Alert className="border-destructive/40 text-destructive">{error}<Button className="mt-3" size="sm" variant="outline" onClick={reload}>{t("retry")}</Button></Alert>
        : view==="month"
          ? <MonthView dates={gridDates} byDate={byDate} locale={dfLocale} todayIso={todayIso} onSelect={setSelected} update={update}/>
          : <WeekView dates={gridDates} byDate={byDate} locale={dfLocale} timeZone={timeZone} update={update} updateDay={updateDay} onSelect={setSelected} empty={t("nothingScheduled")}/>}
    {selected&&<div className="fixed inset-0 z-50 grid items-end bg-foreground/20 md:place-items-center" onClick={()=>setSelected(null)}><section role="dialog" aria-modal="true" aria-label={t("dayDetails")} className="max-h-[88vh] w-full overflow-auto rounded-t-2xl bg-background p-4 shadow-xl md:max-w-xl md:rounded-xl" onClick={event=>event.stopPropagation()}><div className="mb-4 flex items-center justify-between"><div><p className="text-xs text-muted-foreground">{t("selectedDay")}</p><h2 className="text-lg font-semibold">{format(new Date(`${selected}T12:00:00`),"PPPP",{locale:dfLocale})}</h2></div><Button size="icon" variant="ghost" onClick={()=>setSelected(null)} aria-label={t("close")}><X className="size-5"/></Button></div><DatePlanEditor date={selected as IsoDate} items={focusItems} scheduled={selectedDay?.items??[]} onSaved={reload}/><div className="mt-4 space-y-3">{selectedDay?.items.length?selectedDay.items.map(item=><TaskCard key={item.item.id} item={item} date={selected} timeZone={timeZone} onChange={next=>update(selected,next)} onDayChange={updateDay}/>):<Empty label={t("nothingScheduled")}/>}</div></section></div>}
  </div>;
}

export function DatePlanEditor({date,items,scheduled,onSaved}:{date:IsoDate;items:FocusItem[];scheduled:CalendarItem[];onSaved:()=>void}) {
  const t=useTranslations("Calendar");
  const v=useTranslations("Validation");
  const scheduledItems=flattenCalendarItems(scheduled);
  const [itemId,setItemId]=useState(scheduledItems[0]?.item.id??items[0]?.id??"");
  const [minutes,setMinutes]=useState(scheduledItems[0]?.targetMinutes??60);
  const [scope,setScope]=useState<"date"|"future">("date");
  const [skip,setSkip]=useState(false);
  const [busy,setBusy]=useState(false);
  const [minutesError,setMinutesError]=useState("");
  const selectedItemId=itemId||scheduledItems[0]?.item.id||items[0]?.id||"";
  const isScheduled=scheduledItems.some(entry=>entry.item.id===selectedItemId);

  async function save() {
    setMinutesError("");
    if(!selectedItemId)return;
    if(!skip&&(!Number.isInteger(minutes)||minutes<1||minutes>1440)){setMinutesError(v("duration"));return}
    setBusy(true);
    try {
      if(scope==="date") {
        const operation=skip?"skip":isScheduled?"resize":"add";
        await apiFetch(`/api/v1/date-overrides/${date}/${selectedItemId}`,{method:"PUT",body:JSON.stringify(operation==="skip"?{operation}:{operation,durationMinutes:minutes})},()=>({}));
      } else {
        const versions=await getWeeklyPlan();
        const current=latestPlanForDate(versions,date);
        const weekday=new Date(`${date}T12:00:00`).getDay() as Weekday;
        const entries:WeeklyPlanEntry[]=(current?.entries??[]).filter(entry=>!(entry.itemId===selectedItemId&&entry.weekday===weekday));
        if(!skip)entries.push({itemId:selectedItemId,weekday,durationMinutes:minutes});
        await apiFetch("/api/v1/weekly-plan",{method:"PUT",body:JSON.stringify({effectiveFrom:date,entries})},()=>({}));
      }
      onSaved();
      toast.success(t("adjustmentSaved"));
    } catch (error) {
      if(error instanceof ApiClientError&&hasFieldError(error.fieldErrors,"durationMinutes","entries"))setMinutesError(v("duration"));
      else toast.error(t("adjustmentError"));
    } finally {setBusy(false)}
  }

  async function clear() {
    if(!selectedItemId)return;
    setBusy(true);
    try {
      await apiFetch(`/api/v1/date-overrides/${date}/${selectedItemId}`,{method:"DELETE"},()=>undefined);
      onSaved();
      toast.success(t("adjustmentCleared"));
    } catch {
      toast.error(t("adjustmentError"));
    } finally {setBusy(false)}
  }

  return <div className="rounded-lg border bg-muted/30 p-3"><div className="mb-3 flex items-center gap-2 text-sm font-medium"><Settings2 className="size-4"/>{t("adjustSchedule")}</div><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1"><Label htmlFor={`adjust-item-${date}`}>{t("item")}</Label><select id={`adjust-item-${date}`} className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={selectedItemId} onChange={event=>{const id=event.target.value;setItemId(id);setMinutes(scheduledItems.find(entry=>entry.item.id===id)?.targetMinutes??60)}}>{items.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></div><div className="space-y-1"><Label htmlFor={`adjust-scope-${date}`}>{t("scope")}</Label><select id={`adjust-scope-${date}`} className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={scope} onChange={event=>setScope(event.target.value as "date"|"future")}><option value="date">{t("thisDate")}</option><option value="future">{t("weekdayForward")}</option></select></div><div className="space-y-1"><Label htmlFor={`adjust-minutes-${date}`}>{t("targetMinutes")}</Label><Input id={`adjust-minutes-${date}`} className="h-9" type="number" min="1" max="1440" disabled={skip} value={minutes} onChange={event=>{setMinutes(Number(event.target.value));setMinutesError("")}} aria-invalid={!!minutesError} aria-describedby={minutesError?`adjust-minutes-${date}-error`:undefined}/><ValidationFeedback id={`adjust-minutes-${date}-error`} message={minutesError}/></div><label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={skip} onChange={event=>{setSkip(event.target.checked);setMinutesError("")}}/>{t("skipItem")}</label></div><div className="mt-3 flex gap-2"><Button size="sm" onClick={save} disabled={busy||!selectedItemId}>{t("saveAdjustment")}</Button>{scope==="date"&&<Button size="sm" variant="ghost" onClick={clear} disabled={busy||!selectedItemId}>{t("clearAdjustment")}</Button>}</div></div>;
}

function MonthView({dates,byDate,locale,todayIso,onSelect,update}:{dates:Date[];byDate:Map<string,CalendarDay>;locale:typeof enUS;todayIso:string;onSelect:(date:string)=>void;update:(date:string,item:CalendarItem)=>void}) {const weekdays=dates.slice(0,7);return <div data-testid="month-view"><div className="grid grid-cols-7 border-e border-b bg-muted/50">{weekdays.map(date=><div key={date.toISOString()} className="border-s border-t p-2 text-center text-xs font-medium text-muted-foreground">{format(date,"EEE",{locale})}</div>)}</div><div className="grid grid-cols-7 border-e border-b bg-background">{dates.map(date=>{const iso=format(date,"yyyy-MM-dd"),day=byDate.get(iso),outside=date.getMonth()!==dates[Math.floor(dates.length/2)].getMonth(),indicators=flattenCalendarItems(day?.items??[]);return <button key={iso} data-date={iso} aria-label={format(date,"PPPP",{locale})} onClick={()=>onSelect(iso)} className={`min-h-20 border-s border-t p-1.5 text-start md:min-h-40 md:p-2 ${outside?"bg-muted/30 text-muted-foreground":""}`}><span className={`inline-grid size-6 place-items-center rounded-full text-xs ${iso===todayIso?"bg-primary text-primary-foreground":""}`}>{format(date,"d",{locale})}</span><div data-testid="phone-month-indicators" className="mt-1 space-y-1 md:hidden">{indicators.map(item=><span key={item.item.id} className="block h-1 overflow-hidden rounded-full bg-muted" title={`${Math.round(item.percent)}%`}><span className="block h-full rounded-full bg-primary" style={{width:`${item.percent}%`}}/></span>)}</div><div className="mt-1 hidden space-y-1.5 md:block">{day?.items.map(item=><TaskCard key={item.item.id} item={item} date={iso} compact onChange={next=>update(iso,next)}/>)}</div></button>})}</div></div>}
function WeekView({dates,byDate,locale,timeZone,update,updateDay,onSelect,empty}:{dates:Date[];byDate:Map<string,CalendarDay>;locale:typeof enUS;timeZone?:string;update:(date:string,item:CalendarItem)=>void;updateDay:(day:CalendarDay)=>void;onSelect:(date:string)=>void;empty:string}) {const [active,setActive]=useState(format(new Date(),"yyyy-MM-dd"));const effective=dates.some(date=>format(date,"yyyy-MM-dd")===active)?active:format(dates[0],"yyyy-MM-dd");return <><div data-testid="phone-week-selector" className="mb-4 grid grid-cols-7 gap-1 md:hidden">{dates.map(date=>{const iso=format(date,"yyyy-MM-dd");return <button key={iso} data-date={iso} aria-label={format(date,"PPPP",{locale})} aria-pressed={effective===iso} onClick={()=>setActive(iso)} className={`rounded-lg p-2 text-center ${effective===iso?"bg-primary text-primary-foreground":"bg-secondary"}`}><span className="block text-[10px]">{format(date,"EEE",{locale})}</span><span className="text-sm font-semibold">{format(date,"d",{locale})}</span></button>})}</div><div data-testid="phone-week-stack" className="space-y-4 md:hidden"><DayStack date={effective} day={byDate.get(effective)} locale={locale} timeZone={timeZone} update={update} updateDay={updateDay} onSelect={onSelect} empty={empty}/></div><div data-testid="desktop-week-grid" className="hidden grid-cols-7 gap-3 md:grid">{dates.map(date=>{const iso=format(date,"yyyy-MM-dd");return <DayStack key={iso} date={iso} day={byDate.get(iso)} locale={locale} timeZone={timeZone} update={update} updateDay={updateDay} onSelect={onSelect} empty={empty}/>})}</div></>}
function DayStack({date,day,locale,timeZone,update,updateDay,onSelect,empty}:{date:string;day?:CalendarDay;locale:typeof enUS;timeZone?:string;update:(date:string,item:CalendarItem)=>void;updateDay:(day:CalendarDay)=>void;onSelect:(date:string)=>void;empty:string}) {const value=new Date(`${date}T12:00:00`);return <section className="min-w-0"><button className="mb-2 text-start" onClick={()=>onSelect(date)}><p className="text-xs uppercase tracking-wide text-muted-foreground">{format(value,"EEEE",{locale})}</p><h2 className="font-semibold">{format(value,"MMM d",{locale})}</h2></button><div className="space-y-3">{day?.items.length?day.items.map(item=><TaskCard key={item.item.id} item={item} date={date} timeZone={timeZone} onChange={next=>update(date,next)} onDayChange={updateDay}/>):<Empty label={empty}/>}</div></section>}
function Empty({label}:{label:string}){return <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">{label}</div>}
function eachDay(start:Date,end:Date){const result:Date[]=[];let date=start;while(date<=end){result.push(date);date=addDays(date,1)}return result}
function flattenCalendarItems(items:CalendarItem[]):CalendarItem[]{return items.flatMap(item=>[item,...flattenCalendarItems(item.subtasks)])}
function replaceCalendarItem(items:CalendarItem[],next:CalendarItem):CalendarItem[]{return items.map(item=>{
  if(item.item.id===next.item.id)return next;
  const previousChild=item.subtasks.find(child=>child.item.id===next.item.id);
  const subtasks=replaceCalendarItem(item.subtasks,next);
  if(!previousChild)return {...item,subtasks};
  const contributedMinutes=item.contributedMinutes+next.directMinutes-previousChild.directMinutes;
  const actualMinutes=item.directMinutes+contributedMinutes;
  return {...item,subtasks,contributedMinutes,actualMinutes,remainingMinutes:Math.max(0,item.targetMinutes-actualMinutes),percent:Math.min(100,(actualMinutes/item.targetMinutes)*100),complete:actualMinutes>=item.targetMinutes&&item.checklist.every(step=>step.completed)};
})}
