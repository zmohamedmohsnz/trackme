export type ChecklistItem={id:string;title:string;done:boolean};
export type CalendarItem={id:string;title:string;parent?:string;targetMinutes:number;directMinutes:number;contributedMinutes:number;checklist:ChecklistItem[];color:number;completionActionId?:string};
export type CalendarDay={date:string;items:CalendarItem[]};

const study=(date:string):CalendarDay=>({date,items:[
  {id:"area-study",title:"Deep work",targetMinutes:120,directMinutes:35,contributedMinutes:45,color:2,checklist:[{id:"c1",title:"Review priorities",done:true},{id:"c2",title:"Capture learnings",done:false}]},
  {id:"sub-reading",title:"Focused reading",parent:"Deep work",targetMinutes:45,directMinutes:45,contributedMinutes:0,color:4,checklist:[{id:"c3",title:"Read one chapter",done:true}]},
]});
export function demoCalendar(from:string,to:string){
  const days:CalendarDay[]=[]; const cursor=new Date(`${from}T12:00:00`); const end=new Date(`${to}T12:00:00`);
  while(cursor<=end){const iso=cursor.toISOString().slice(0,10); const day=cursor.getDay(); days.push(day===0?{date:iso,items:[]}:study(iso));cursor.setDate(cursor.getDate()+1)}
  return {days,demo:true};
}
