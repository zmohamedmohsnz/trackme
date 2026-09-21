import type {FocusItem} from "@/types/domain";

export function activeFocusItems(items:FocusItem[]){
  return items.filter(item=>!item.archivedAt);
}
