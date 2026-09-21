import {describe,expect,it} from "vitest";
import {activeFocusItems} from "@/lib/domain/focus-items";
import type {FocusItem} from "@/types/domain";

const task:FocusItem={id:"task",areaId:"area",name:"Task",position:0,checklist:[]};

describe("task lifecycle",()=>{
  it("keeps tasks eligible when their area is archived or they are unassigned",()=>{
    expect(activeFocusItems([task,{...task,id:"unassigned",areaId:null}]).map(item=>item.id)).toEqual(["task","unassigned"]);
  });
  it("filters only independently archived tasks",()=>{
    expect(activeFocusItems([{...task,archivedAt:"2026-09-13T00:00:00Z"},{...task,id:"other"}]).map(item=>item.id)).toEqual(["other"]);
  });
});
