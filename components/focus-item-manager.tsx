"use client";

import {useEffect,useMemo,useState} from "react";
import {Archive,ArchiveRestore,ArrowDown,ArrowUp,Check,LoaderCircle,Plus,Save,X} from "lucide-react";
import {useTranslations} from "next-intl";
import {toast} from "sonner";
import {todayInTimeZone} from "@/lib/domain/dates";
import {activeFocusItems} from "@/lib/domain/focus-items";
import {effectiveChecklist} from "@/lib/domain/progress";
import type {ChecklistOperation,ChecklistStep,FocusItem,IsoDate} from "@/types/domain";
import {apiFetch,getFocusItems} from "./api-client";
import {ValidationFeedback} from "./validation-feedback";
import {Badge} from "./ui/badge";
import {Button} from "./ui/button";
import {Card,CardContent,CardDescription,CardHeader,CardTitle} from "./ui/card";
import {Input} from "./ui/input";
import {Label} from "./ui/label";
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from "./ui/select";

export function FocusItemManager({timezone}:{timezone:string}){
  const t=useTranslations("FocusManager");
  const v=useTranslations("Validation");
  const [items,setItems]=useState<FocusItem[]>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [effectiveFrom,setEffectiveFrom]=useState<IsoDate>(()=>todayInTimeZone(timezone));
  const [areaName,setAreaName]=useState("");
  const [subtaskName,setSubtaskName]=useState("");
  const [parentId,setParentId]=useState("");
  const [createErrors,setCreateErrors]=useState<Record<string,string>>({});

  useEffect(()=>{getFocusItems(true).then(setItems).catch(()=>toast.error(t("error"))).finally(()=>setLoading(false))},[t]);

  const active=useMemo(()=>activeFocusItems(items),[items]);
  const areas=active.filter(item=>item.kind==="area").sort(byPosition);
  const archived=items.filter(item=>!!item.archivedAt).sort(byPosition);
  const selectedParentId=areas.some(area=>area.id===parentId)?parentId:areas[0]?.id??"";

  function replace(item:FocusItem){setItems(current=>current.map(candidate=>candidate.id===item.id?item:candidate))}

  async function create(kind:"area"|"subtask"){
    const name=kind==="area"?areaName:subtaskName;
    if(!name.trim()||name.trim().length>200){setCreateErrors(current=>({...current,[kind]:v("name")}));return}if(kind==="subtask"&&!selectedParentId)return;
    const siblings=items.filter(item=>item.kind===kind&&(kind==="area"||item.parentId===selectedParentId));
    setBusy(true);
    try{
      const created=await apiFetch<FocusItem>("/api/v1/focus-items",{method:"POST",body:JSON.stringify({kind,parentId:kind==="subtask"?selectedParentId:undefined,name,position:siblings.length,checklist:[]})},()=>({id:crypto.randomUUID(),kind,parentId:kind==="subtask"?selectedParentId:null,name,position:siblings.length,archivedAt:null,checklist:[]}));
      setItems(current=>[...current,created]);
      if(kind==="area")setAreaName("");else setSubtaskName("");
      toast.success(t("created"));
    }catch{toast.error(t("error"))}finally{setBusy(false)}
  }

  async function patchItem(item:FocusItem,changes:Record<string,unknown>,successKey:string){
    setBusy(true);
    try{
      const updated=await apiFetch<FocusItem>("/api/v1/focus-items",{method:"PATCH",body:JSON.stringify({id:item.id,...changes})},()=>({...item,...("name" in changes?{name:String(changes.name)}:{}),...("parentId" in changes?{parentId:String(changes.parentId)}:{}),...("position" in changes?{position:Number(changes.position)}:{}),...("archived" in changes?{archivedAt:changes.archived?new Date().toISOString():null}:{})}));
      replace(updated);toast.success(t(successKey));return updated;
    }catch{toast.error(t("error"));return null}finally{setBusy(false)}
  }

  async function moveItem(item:FocusItem,direction:-1|1){
    const siblings=active.filter(candidate=>candidate.kind===item.kind&&(item.kind==="area"||candidate.parentId===item.parentId)).sort(byPosition);
    const index=siblings.findIndex(candidate=>candidate.id===item.id);const other=siblings[index+direction];if(!other)return;
    setBusy(true);
    try{
      const [first,second]=await Promise.all([
        apiFetch<FocusItem>("/api/v1/focus-items",{method:"PATCH",body:JSON.stringify({id:item.id,position:other.position})},()=>({...item,position:other.position})),
        apiFetch<FocusItem>("/api/v1/focus-items",{method:"PATCH",body:JSON.stringify({id:other.id,position:item.position})},()=>({...other,position:item.position})),
      ]);
      setItems(current=>current.map(candidate=>candidate.id===first.id?first:candidate.id===second.id?second:candidate));
    }catch{toast.error(t("error"))}finally{setBusy(false)}
  }

  async function maintainChecklist(item:FocusItem,operations:ChecklistOperation[],successKey:string){
    setBusy(true);
    try{
      const updated=await apiFetch<FocusItem>("/api/v1/focus-items",{method:"PATCH",body:JSON.stringify({id:item.id,checklistOperations:operations})},()=>applyDemoChecklist(item,operations));
      replace(updated);toast.success(t(successKey));
    }catch{toast.error(t("checklistError"))}finally{setBusy(false)}
  }

  if(loading)return <Card><CardContent className="grid min-h-48 place-items-center"><LoaderCircle className="size-6 animate-spin"/></CardContent></Card>;
  return <div className="space-y-5">
    <Card>
      <CardHeader><CardTitle>{t("title")}</CardTitle><CardDescription>{t("description")}</CardDescription></CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]"><div><Input aria-label={t("areaName")} value={areaName} onChange={event=>{setAreaName(event.target.value);setCreateErrors(current=>({...current,area:""}))}} placeholder={t("areaPlaceholder")} aria-invalid={!!createErrors.area} aria-describedby={createErrors.area?"create-area-error":undefined}/><ValidationFeedback id="create-area-error" message={createErrors.area}/></div><Button disabled={busy||!areaName.trim()} onClick={()=>create("area")}><Plus className="size-4"/>{t("addArea")}</Button></div>
        {areas.length>0&&<div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]"><Select value={selectedParentId} onValueChange={setParentId}><SelectTrigger aria-label={t("parentArea")}><SelectValue/></SelectTrigger><SelectContent>{areas.map(area=><SelectItem key={area.id} value={area.id}>{area.name}</SelectItem>)}</SelectContent></Select><div><Input aria-label={t("subtaskName")} value={subtaskName} onChange={event=>{setSubtaskName(event.target.value);setCreateErrors(current=>({...current,subtask:""}))}} placeholder={t("subtaskPlaceholder")} aria-invalid={!!createErrors.subtask} aria-describedby={createErrors.subtask?"create-subtask-error":undefined}/><ValidationFeedback id="create-subtask-error" message={createErrors.subtask}/></div><Button disabled={busy||!subtaskName.trim()||!selectedParentId} onClick={()=>create("subtask")}><Plus className="size-4"/>{t("addSubtask")}</Button></div>}
        <div className="max-w-xs space-y-2"><Label htmlFor="checklist-effective-from">{t("effectiveFrom")}</Label><Input id="checklist-effective-from" type="date" value={effectiveFrom} onChange={event=>setEffectiveFrom(event.target.value as IsoDate)}/></div>
      </CardContent>
    </Card>
    {areas.map((area,index)=><div key={area.id} className="space-y-3"><ItemEditor item={area} items={active} areas={areas} effectiveFrom={effectiveFrom} busy={busy} first={index===0} last={index===areas.length-1} t={t} nameErrorMessage={v("name")} onPatch={patchItem} onMove={moveItem} onChecklist={maintainChecklist}/>{active.filter(item=>item.kind==="subtask"&&item.parentId===area.id).sort(byPosition).map((subtask,subtaskIndex,subtasks)=><div className="ms-4 border-s-2 ps-4 sm:ms-8" key={subtask.id}><ItemEditor item={subtask} items={active} areas={areas} effectiveFrom={effectiveFrom} busy={busy} first={subtaskIndex===0} last={subtaskIndex===subtasks.length-1} t={t} nameErrorMessage={v("name")} onPatch={patchItem} onMove={moveItem} onChecklist={maintainChecklist}/></div>)}</div>)}
    {!areas.length&&<Card><CardContent className="pt-5 text-sm text-muted-foreground">{t("noItems")}</CardContent></Card>}
    <Card><CardHeader><CardTitle>{t("archived")}</CardTitle><CardDescription>{t("archivedDescription")}</CardDescription></CardHeader><CardContent>{archived.length?<ul className="divide-y">{archived.map(item=><li key={item.id} className="flex items-center justify-between gap-3 py-3 text-sm"><span><Badge className="me-2">{t(item.kind)}</Badge>{item.name}</span><Button disabled={busy} size="sm" variant="outline" onClick={()=>patchItem(item,{archived:false},"restored")}><ArchiveRestore className="size-4"/>{t("restore")}</Button></li>)}</ul>:<p className="text-sm text-muted-foreground">{t("noneArchived")}</p>}</CardContent></Card>
  </div>;
}

function ItemEditor({item,items,areas,effectiveFrom,busy,first,last,t,nameErrorMessage,onPatch,onMove,onChecklist}:{item:FocusItem;items:FocusItem[];areas:FocusItem[];effectiveFrom:IsoDate;busy:boolean;first:boolean;last:boolean;t:(key:string)=>string;nameErrorMessage:string;onPatch:(item:FocusItem,changes:Record<string,unknown>,successKey:string)=>Promise<FocusItem|null>;onMove:(item:FocusItem,direction:-1|1)=>Promise<void>;onChecklist:(item:FocusItem,operations:ChecklistOperation[],successKey:string)=>Promise<void>}){
  const [name,setName]=useState(item.name);const [nameError,setNameError]=useState("");const [newStep,setNewStep]=useState("");const [labels,setLabels]=useState<Record<string,string>>({});
  const steps=effectiveChecklist(item.checklist,effectiveFrom);
  function labelFor(step:ChecklistStep){return labels[step.id]??step.label}
  function revise(step:ChecklistStep){return onChecklist(item,[{operation:"revise",id:step.id,label:labelFor(step),position:step.position,effectiveFrom}],"checklistSaved")}
  function moveStep(step:ChecklistStep,direction:-1|1){const index=steps.findIndex(candidate=>candidate.id===step.id);const other=steps[index+direction];if(!other)return Promise.resolve();return onChecklist(item,[{operation:"revise",id:step.id,label:labelFor(step),position:other.position,effectiveFrom},{operation:"revise",id:other.id,label:labelFor(other),position:step.position,effectiveFrom}],"checklistSaved")}
  return <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><Badge>{t(item.kind)}</Badge><CardTitle className="text-base">{item.name}</CardTitle></div><div className="flex gap-1"><Button aria-label={t("moveUp")} disabled={busy||first} size="icon" variant="ghost" onClick={()=>onMove(item,-1)}><ArrowUp className="size-4"/></Button><Button aria-label={t("moveDown")} disabled={busy||last} size="icon" variant="ghost" onClick={()=>onMove(item,1)}><ArrowDown className="size-4"/></Button><Button aria-label={t("archive")} disabled={busy} size="icon" variant="ghost" onClick={()=>onPatch(item,{archived:true},"archivedSuccess")}><Archive className="size-4"/></Button></div></div></CardHeader><CardContent className="space-y-5">
    <div className="grid gap-2 sm:grid-cols-[1fr_auto]"><div><Input aria-label={t("rename")} value={name} onChange={event=>{setName(event.target.value);setNameError("")}} aria-invalid={!!nameError} aria-describedby={nameError?`${item.id}-name-error`:undefined}/><ValidationFeedback id={`${item.id}-name-error`} message={nameError}/></div><Button disabled={busy||!name.trim()||name===item.name} variant="outline" onClick={()=>{if(name.trim().length>200){setNameError(nameErrorMessage);return}void onPatch(item,{name},"renamed")} }><Save className="size-4"/>{t("saveName")}</Button></div>
    {item.kind==="subtask"&&<div className="space-y-2"><Label>{t("parentArea")}</Label><Select value={item.parentId??""} onValueChange={nextParentId=>{const nextPosition=Math.max(-1,...items.filter(candidate=>candidate.kind==="subtask"&&candidate.parentId===nextParentId).map(candidate=>candidate.position))+1;onPatch(item,{parentId:nextParentId,position:nextPosition},"moved")}} disabled={busy}><SelectTrigger aria-label={t("parentArea")}><SelectValue/></SelectTrigger><SelectContent>{areas.map(area=><SelectItem key={area.id} value={area.id}>{area.name}</SelectItem>)}</SelectContent></Select></div>}
    <div className="space-y-3"><Label>{t("checklist")}</Label>{steps.map((step,index)=><div key={step.id} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_auto_auto_auto]"><Input aria-label={t("stepLabel")} value={labelFor(step)} onChange={event=>setLabels(current=>({...current,[step.id]:event.target.value}))}/><Button aria-label={t("saveStep")} disabled={busy||!labelFor(step).trim()} size="icon" variant="outline" onClick={()=>revise(step)}><Check className="size-4"/></Button><div className="flex"><Button aria-label={t("moveStepUp")} disabled={busy||index===0} size="icon" variant="ghost" onClick={()=>moveStep(step,-1)}><ArrowUp className="size-4"/></Button><Button aria-label={t("moveStepDown")} disabled={busy||index===steps.length-1} size="icon" variant="ghost" onClick={()=>moveStep(step,1)}><ArrowDown className="size-4"/></Button></div><Button aria-label={t("retireStep")} disabled={busy} size="icon" variant="ghost" onClick={()=>onChecklist(item,[{operation:"retire",id:step.id,effectiveFrom}],"checklistRetired")}><X className="size-4"/></Button></div>)}{!steps.length&&<p className="text-sm text-muted-foreground">{t("noChecklist")}</p>}<div className="grid gap-2 sm:grid-cols-[1fr_auto]"><Input aria-label={t("newStep")} value={newStep} onChange={event=>setNewStep(event.target.value)} placeholder={t("stepPlaceholder")}/><Button disabled={busy||!newStep.trim()} variant="outline" onClick={async()=>{await onChecklist(item,[{operation:"add",label:newStep,position:steps.length,effectiveFrom}],"checklistSaved");setNewStep("")}}><Plus className="size-4"/>{t("addStep")}</Button></div></div>
  </CardContent></Card>;
}

function byPosition(a:FocusItem,b:FocusItem){return a.position-b.position||a.name.localeCompare(b.name)}

function applyDemoChecklist(item:FocusItem,operations:ChecklistOperation[]):FocusItem{
  let checklist=[...item.checklist];
  for(const operation of operations){
    if(operation.operation==="add")checklist.push({id:crypto.randomUUID(),itemId:item.id,label:operation.label,position:operation.position,effectiveFrom:operation.effectiveFrom});
    else if(operation.operation==="retire")checklist=checklist.map(step=>step.id===operation.id?{...step,effectiveTo:previousDate(operation.effectiveFrom)}:step);
    else checklist=checklist.flatMap(step=>step.id!==operation.id?[step]:step.effectiveFrom===operation.effectiveFrom?[{...step,label:operation.label,position:operation.position}]:[{...step,effectiveTo:previousDate(operation.effectiveFrom)},{id:crypto.randomUUID(),itemId:item.id,label:operation.label,position:operation.position,effectiveFrom:operation.effectiveFrom,effectiveTo:step.effectiveTo}]);
  }
  return {...item,checklist};
}

function previousDate(date:IsoDate):IsoDate{const value=new Date(`${date}T12:00:00Z`);value.setUTCDate(value.getUTCDate()-1);return value.toISOString().slice(0,10) as IsoDate}
