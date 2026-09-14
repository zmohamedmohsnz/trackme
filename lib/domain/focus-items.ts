import type {FocusItem} from "@/types/domain";

export function activeFocusItems(items:FocusItem[]){
  const areaIds=new Set(items.filter(item=>item.kind==="area"&&!item.archivedAt).map(item=>item.id));
  return items.filter(item=>!item.archivedAt&&(item.kind==="area"||!!item.parentId&&areaIds.has(item.parentId)));
}
