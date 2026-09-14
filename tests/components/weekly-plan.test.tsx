import {cleanup,render,screen,waitFor} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {NextIntlClientProvider} from "next-intl";
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import en from "../../messages/en.json";

const mocks=vi.hoisted(()=>({apiFetch:vi.fn(),getFocusItems:vi.fn(),getSettings:vi.fn(),getWeeklyPlan:vi.fn()}));
vi.mock("../../components/api-client",()=>({...mocks,ApiClientError:class extends Error{},demoMode:false}));
vi.mock("sonner",()=>({toast:{success:vi.fn(),error:vi.fn()}}));

import {WeeklyPlan} from "../../components/weekly-plan";

describe("WeeklyPlan",()=>{
  beforeEach(()=>{
    vi.clearAllMocks();
    mocks.getFocusItems.mockResolvedValue([{id:"00000000-0000-4000-8000-000000000001",kind:"area",name:"Deep work",position:0,archivedAt:null,checklist:[]}]);
    mocks.getSettings.mockResolvedValue({locale:"en",timezone:"Africa/Cairo",weekStartsOn:6,onboardingStep:3,onboardingCompleted:true});
    mocks.getWeeklyPlan.mockResolvedValue([{id:"plan-1",effectiveFrom:"2026-01-01",effectiveTo:null,entries:[
      {itemId:"00000000-0000-4000-8000-000000000001",weekday:1,durationMinutes:90},
      {itemId:"00000000-0000-4000-8000-000000000001",weekday:3,durationMinutes:45},
    ]}]);
    mocks.apiFetch.mockResolvedValue([]);
  });
  afterEach(cleanup);

  it("edits one weekday without losing the other weekday target",async()=>{
    const user=userEvent.setup();
    render(<NextIntlClientProvider locale="en" messages={en}><WeeklyPlan/></NextIntlClientProvider>);
    const monday=await screen.findByRole("spinbutton",{name:"Mon Target minutes"});
    const wednesday=screen.getByRole("spinbutton",{name:"Wed Target minutes"});
    await user.clear(monday);await user.type(monday,"120");
    expect(wednesday).toHaveValue(45);
    await user.click(screen.getByRole("button",{name:"Save plan"}));
    await waitFor(()=>expect(mocks.apiFetch).toHaveBeenCalled());
    const [,init]=mocks.apiFetch.mock.calls.at(-1)!;
    expect(JSON.parse(init.body)).toMatchObject({entries:expect.arrayContaining([
      {itemId:"00000000-0000-4000-8000-000000000001",weekday:1,durationMinutes:120},
      {itemId:"00000000-0000-4000-8000-000000000001",weekday:3,durationMinutes:45},
    ])});
  });

  it("validates duration edits before mutation",async()=>{
    const user=userEvent.setup();
    render(<NextIntlClientProvider locale="en" messages={en}><WeeklyPlan/></NextIntlClientProvider>);
    const monday=await screen.findByRole("spinbutton",{name:"Mon Target minutes"});
    await user.clear(monday);await user.type(monday,"1441");
    await user.click(screen.getByRole("button",{name:"Save plan"}));
    expect(screen.getByText("Enter a whole number from 1 to 1,440 minutes.")).toBeInTheDocument();
    expect(monday).toHaveAttribute("aria-invalid","true");
    expect(mocks.apiFetch).not.toHaveBeenCalled();
  });
});
