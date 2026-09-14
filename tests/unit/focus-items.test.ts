import {describe,expect,it} from "vitest";
import {activeFocusItems} from "@/lib/domain/focus-items";
import type {FocusItem} from "@/types/domain";

const area:FocusItem={id:"area",kind:"area",name:"Area",position:0,checklist:[]};
const child:FocusItem={id:"child",kind:"subtask",parentId:"area",name:"Child",position:0,checklist:[]};

describe("focus item lifecycle",()=>{
  it("suppresses active children while their parent is archived",()=>{
    expect(activeFocusItems([{...area,archivedAt:"2026-09-13T00:00:00Z"},child])).toEqual([]);
  });

  it("makes eligible children available when their parent is restored",()=>{
    expect(activeFocusItems([area,child]).map(item=>item.id)).toEqual(["area","child"]);
  });

  it("does not restore a child that is independently archived",()=>{
    expect(activeFocusItems([area,{...child,archivedAt:"2026-09-13T00:00:00Z"}]).map(item=>item.id)).toEqual(["area"]);
  });
});
