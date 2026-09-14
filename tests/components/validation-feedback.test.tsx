import {cleanup,render,screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {NextIntlClientProvider} from "next-intl";
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import ar from "../../messages/ar.json";
import en from "../../messages/en.json";

const mocks=vi.hoisted(()=>({apiFetch:vi.fn(),getSettings:vi.fn(),getFocusItems:vi.fn(),getWeeklyPlan:vi.fn()}));
vi.mock("@/components/api-client",async(importOriginal)=>{
  const actual=await importOriginal<typeof import("@/components/api-client")>();
  return {...actual,demoMode:false,apiFetch:mocks.apiFetch,getSettings:mocks.getSettings,getFocusItems:mocks.getFocusItems,getWeeklyPlan:mocks.getWeeklyPlan};
});
vi.mock("next/navigation",()=>({useRouter:()=>({push:vi.fn()})}));
vi.mock("sonner",()=>({toast:{success:vi.fn(),error:vi.fn()}}));

import {ApiClientError} from "@/components/api-client";
import {SettingsPanel} from "@/components/settings-panel";
import {TaskCard} from "@/components/task-card";
import {AuthForm} from "@/components/auth-form";
import {DatePlanEditor} from "@/components/calendar-dashboard";
import {WeeklyPlan} from "@/components/weekly-plan";
import type {CalendarItem} from "@/types/domain";

const item:CalendarItem={item:{id:"item-1",kind:"area",name:"Deep work",position:0,checklist:[]},date:"2026-09-13",targetMinutes:60,directMinutes:0,contributedMinutes:0,actualMinutes:0,remainingMinutes:60,percent:0,complete:false,checklist:[],manualEntries:[],subtasks:[]};

describe("localized validation feedback",()=>{
  beforeEach(()=>{
    vi.clearAllMocks();
    mocks.getSettings.mockResolvedValue({locale:"en",timezone:"Africa/Cairo",weekStartsOn:6,onboardingStep:3,onboardingCompleted:true});
    mocks.getFocusItems.mockResolvedValue([]);
    mocks.getWeeklyPlan.mockResolvedValue([]);
  });
  afterEach(cleanup);

  it.each([
    ["en",en,"Enter a valid IANA timezone."],
    ["ar",ar,"أدخل منطقة زمنية صالحة من قاعدة IANA."],
  ])("shows a localized timezone error in %s and inherits page direction",async(locale,messages,errorText)=>{
    const user=userEvent.setup();
    mocks.apiFetch.mockRejectedValue(new ApiClientError(400,"validation_error","invalid",{timezone:["invalid"]}));
    render(<div dir={locale==="ar"?"rtl":"ltr"}><NextIntlClientProvider locale={locale} messages={messages}><SettingsPanel/></NextIntlClientProvider></div>);
    const input=await screen.findByRole("textbox",{name:locale==="ar"?"المنطقة الزمنية":"Timezone"});
    await user.clear(input);await user.type(input,"Mars/Olympus");await user.click(screen.getByRole("button",{name:locale==="ar"?"حفظ الإعدادات":"Save settings"}));
    expect(await screen.findByText(errorText)).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-invalid","true");
    expect(screen.getByText(errorText).closest("[dir]")).toHaveAttribute("dir",locale==="ar"?"rtl":"ltr");
  });

  it("shows inline duration feedback for a manual time entry",async()=>{
    const user=userEvent.setup();
    render(<NextIntlClientProvider locale="en" messages={en}><TaskCard item={item} date="2026-09-13"/></NextIntlClientProvider>);
    const input=screen.getByRole("spinbutton",{name:"Minutes"});
    await user.type(input,"0");await user.click(screen.getByRole("button",{name:"Add"}));
    expect(await screen.findByText("Enter a whole number from 1 to 1,440 minutes.")).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-invalid","true");
  });

  it("shows Arabic auth field errors in an RTL form",async()=>{
    const user=userEvent.setup();
    render(<div dir="rtl"><NextIntlClientProvider locale="ar" messages={ar}><AuthForm mode="signup"/></NextIntlClientProvider></div>);
    await user.type(screen.getByLabelText("البريد الإلكتروني"),"invalid");
    await user.type(screen.getByLabelText("كلمة المرور"),"short");
    await user.click(screen.getByRole("button",{name:"إنشاء الحساب"}));
    expect(screen.getByText("أدخل عنوان بريد إلكتروني صالحًا.")).toBeInTheDocument();
    expect(screen.getByText("استخدم 8 أحرف على الأقل.").closest("[dir]")).toHaveAttribute("dir","rtl");
  });

  it("validates weekly-plan durations beside the affected weekday",async()=>{
    const user=userEvent.setup();
    mocks.getFocusItems.mockResolvedValue([{id:"item-1",kind:"area",name:"Deep work",position:0,archivedAt:null,checklist:[]}]);
    mocks.getWeeklyPlan.mockResolvedValue([{id:"plan-1",effectiveFrom:"2026-09-01",entries:[{itemId:"item-1",weekday:6,durationMinutes:60}]}]);
    render(<NextIntlClientProvider locale="en" messages={en}><WeeklyPlan/></NextIntlClientProvider>);
    const input=await screen.findByRole("spinbutton",{name:"Sat Target minutes"});
    await user.clear(input);await user.type(input,"0");await user.click(screen.getByRole("button",{name:"Save plan"}));
    expect(screen.getByText("Enter a whole number from 1 to 1,440 minutes.")).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-invalid","true");
  });

  it("shows an inline error for a missing effective date",async()=>{
    const user=userEvent.setup();
    mocks.getFocusItems.mockResolvedValue([{id:"item-1",kind:"area",name:"Deep work",position:0,archivedAt:null,checklist:[]}]);
    render(<NextIntlClientProvider locale="en" messages={en}><WeeklyPlan/></NextIntlClientProvider>);
    const input=await screen.findByLabelText("Effective from");
    await user.clear(input);await user.click(screen.getByRole("button",{name:"Save plan"}));
    expect(screen.getByText("Enter a valid date.")).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-invalid","true");
  });

  it("validates a one-date schedule adjustment inline",async()=>{
    const user=userEvent.setup();
    render(<NextIntlClientProvider locale="en" messages={en}><DatePlanEditor date="2026-09-13" items={[item.item]} scheduled={[item]} onSaved={vi.fn()}/></NextIntlClientProvider>);
    const input=screen.getByRole("spinbutton",{name:"Target minutes"});
    await user.clear(input);await user.type(input,"0");await user.click(screen.getByRole("button",{name:"Save adjustment"}));
    expect(screen.getByText("Enter a whole number from 1 to 1,440 minutes.")).toBeInTheDocument();
  });
});
