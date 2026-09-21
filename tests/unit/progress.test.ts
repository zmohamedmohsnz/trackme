import {describe,expect,it} from "vitest";
import {buildCalendar,effectiveChecklist,planCompletion,progress} from "@/lib/domain/progress";
import type {FocusItem} from "@/types/domain";

const items:FocusItem[]=[
  {id:"assigned",areaId:"archived-area",name:"Run",position:0,checklist:[{id:"step",itemId:"assigned",label:"Stretch",position:0,effectiveFrom:"2026-01-01"}]},
  {id:"unassigned",areaId:null,name:"Read",position:1,checklist:[]},
];
const versions=[{id:"v",effectiveFrom:"2026-01-01" as const,entries:[{itemId:"assigned",weekday:1 as const,durationMinutes:60},{itemId:"unassigned",weekday:1 as const,durationMinutes:30}]}];
const base={from:"2026-02-09" as const,to:"2026-02-09" as const,items,versions,overrides:[],timeEntries:[],checklistCompletions:[]};

describe("flat task progress",()=>{
  it("plans only missing time and steps",()=>expect(planCompletion(60,25,[{id:"done",completed:true},{id:"missing",completed:false}])).toEqual({fillMinutes:35,checklistStepIds:["missing"]}));
  it("caps percent without capping actual time",()=>expect(progress(75,60,true)).toEqual({actualMinutes:75,percent:100,complete:true}));
  it("requires the task's own checklist",()=>expect(progress(60,60,false).complete).toBe(false));
  it("uses effective checklist dates",()=>expect(effectiveChecklist([{id:"s",itemId:"i",label:"x",position:0,effectiveFrom:"2026-02-01",effectiveTo:"2026-02-28"}],"2026-03-01")).toEqual([]));
  it("shows independently scheduled assigned and unassigned tasks",()=>{
    const [day]=buildCalendar({...base,timeEntries:[{id:"a",itemId:"assigned",date:"2026-02-09",minutes:20,source:"manual" as const,createdAt:"2026-02-09T08:00:00Z"},{id:"b",itemId:"unassigned",date:"2026-02-09",minutes:45,source:"completion_fill" as const,createdAt:"2026-02-09T09:00:00Z"}]});
    expect(day.items.map(item=>({id:item.item.id,actual:item.actualMinutes,children:item.subtasks.length}))).toEqual([{id:"assigned",actual:20,children:0},{id:"unassigned",actual:45,children:0}]);
  });
  it("does not suppress another task when one is skipped or archived",()=>{
    const [skipped]=buildCalendar({...base,overrides:[{date:"2026-02-09",itemId:"assigned",operation:"skip" as const}]});
    const [archived]=buildCalendar({...base,items:[{...items[0],archivedAt:"2026-02-01T00:00:00Z"},items[1]]});
    expect(skipped.items.map(item=>item.item.id)).toEqual(["unassigned"]);
    expect(archived.items.map(item=>item.item.id)).toEqual(["unassigned"]);
  });
});
