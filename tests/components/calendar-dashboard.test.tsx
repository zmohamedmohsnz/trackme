import {cleanup,render,screen,waitFor} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {NextIntlClientProvider} from "next-intl";
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import type {CalendarItem,FocusItem} from "../../types/domain";
import ar from "../../messages/ar.json";
import en from "../../messages/en.json";

const mocks=vi.hoisted(()=>({apiFetch:vi.fn(),getCalendar:vi.fn(),getFocusItems:vi.fn(),getSettings:vi.fn(),getWeeklyPlan:vi.fn()}));
vi.mock("../../components/api-client",()=>({...mocks,ApiClientError:class extends Error{},demoMode:false}));
vi.mock("sonner",()=>({toast:{success:vi.fn(),error:vi.fn()}}));

import {CalendarDashboard,DatePlanEditor} from "../../components/calendar-dashboard";

const focusItem:FocusItem={id:"00000000-0000-4000-8000-000000000001",kind:"area",name:"Deep work",position:0,archivedAt:null,checklist:[]};
const scheduled:CalendarItem={item:focusItem,date:"2026-09-14",targetMinutes:60,directMinutes:0,contributedMinutes:0,actualMinutes:0,remainingMinutes:60,percent:0,complete:false,checklist:[],manualEntries:[],subtasks:[]};

describe("calendar planning and responsive interactions",()=>{
  beforeEach(()=>{vi.clearAllMocks();mocks.apiFetch.mockResolvedValue({});mocks.getWeeklyPlan.mockResolvedValue([{id:"p",effectiveFrom:"2026-01-01",effectiveTo:null,entries:[{itemId:focusItem.id,weekday:1,durationMinutes:60}]}])});
  afterEach(()=>{cleanup();document.documentElement.removeAttribute("dir")});

  it("keeps one-date and weekday-forward mutations distinct",async()=>{
    const user=userEvent.setup();
    const onSaved=vi.fn();
    render(<NextIntlClientProvider locale="en" messages={en}><DatePlanEditor date="2026-09-14" items={[focusItem]} scheduled={[scheduled]} onSaved={onSaved}/></NextIntlClientProvider>);
    await user.clear(screen.getByRole("spinbutton",{name:"Target minutes"}));await user.type(screen.getByRole("spinbutton",{name:"Target minutes"}),"75");
    await user.click(screen.getByRole("button",{name:"Save adjustment"}));
    await waitFor(()=>expect(mocks.apiFetch).toHaveBeenCalledWith(`/api/v1/date-overrides/2026-09-14/${focusItem.id}`,expect.objectContaining({method:"PUT",body:JSON.stringify({operation:"resize",durationMinutes:75})}),expect.any(Function)));

    cleanup();mocks.apiFetch.mockClear();
    render(<NextIntlClientProvider locale="en" messages={en}><DatePlanEditor date="2026-09-14" items={[focusItem]} scheduled={[scheduled]} onSaved={onSaved}/></NextIntlClientProvider>);
    await user.selectOptions(screen.getByRole("combobox",{name:"Apply change to"}),"future");
    await user.clear(screen.getByRole("spinbutton",{name:"Target minutes"}));await user.type(screen.getByRole("spinbutton",{name:"Target minutes"}),"90");
    await user.click(screen.getByRole("button",{name:"Save adjustment"}));
    await waitFor(()=>expect(mocks.apiFetch).toHaveBeenCalledWith("/api/v1/weekly-plan",expect.objectContaining({method:"PUT"}),expect.any(Function)));
    const body=JSON.parse(mocks.apiFetch.mock.calls.at(-1)![1].body);
    expect(body).toEqual({effectiveFrom:"2026-09-14",entries:[{itemId:focusItem.id,weekday:1,durationMinutes:90}]});
  });

  it("supports Arabic RTL week selection and opens the selected day",async()=>{
    const user=userEvent.setup();
    document.documentElement.dir="rtl";
    mocks.getSettings.mockResolvedValue({locale:"ar",timezone:"Africa/Cairo",weekStartsOn:6,onboardingStep:3,onboardingCompleted:true});
    mocks.getFocusItems.mockResolvedValue([focusItem]);
    mocks.getCalendar.mockImplementation(async(from:string,to:string)=>{
      const result=[];const cursor=new Date(`${from}T12:00:00`);const end=new Date(`${to}T12:00:00`);
      while(cursor<=end){result.push({date:cursor.toISOString().slice(0,10),items:[]});cursor.setDate(cursor.getDate()+1)}return result;
    });
    render(<NextIntlClientProvider locale="ar" messages={ar}><CalendarDashboard/></NextIntlClientProvider>);
    await screen.findByRole("button",{name:"الأسبوع"});
    await user.click(screen.getByRole("button",{name:"الأسبوع"}));
    const dayButtons=await screen.findAllByRole("button",{name:/السبت|الأحد|الاثنين|الثلاثاء|الأربعاء|الخميس|الجمعة/});
    await user.click(dayButtons.at(-1)!);
    expect(await screen.findByRole("dialog",{name:"تفاصيل اليوم"})).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute("dir","rtl");
  });
});
