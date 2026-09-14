import {cleanup,render,screen,waitFor} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {NextIntlClientProvider} from "next-intl";
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import type {CalendarItem} from "../../types/domain";
import en from "../../messages/en.json";

const apiMocks=vi.hoisted(()=>({apiFetch:vi.fn(),getCalendar:vi.fn()}));
vi.mock("../../components/api-client",()=>({apiFetch:apiMocks.apiFetch,getCalendar:apiMocks.getCalendar,demoMode:false}));

import {TaskCard} from "../../components/task-card";

const item:CalendarItem={
  item:{id:"item-1",kind:"area",name:"Deep work",position:0,checklist:[]},
  date:"2026-09-12",
  targetMinutes:120,
  directMinutes:45,
  contributedMinutes:0,
  actualMinutes:45,
  remainingMinutes:75,
  percent:37.5,
  complete:false,
  checklist:[],
  manualEntries:[{id:"entry-1",itemId:"item-1",date:"2026-09-12",minutes:45,source:"manual",createdAt:"2026-09-12T20:30:00Z"}],
  subtasks:[],
};

describe("TaskCard manual time history",()=>{
  beforeEach(()=>vi.clearAllMocks());
  afterEach(cleanup);

  it("confirms deletion and refreshes the canonical calendar day",async()=>{
    const user=userEvent.setup();
    const canonical={...item,directMinutes:0,actualMinutes:0,remainingMinutes:120,percent:0,manualEntries:[]};
    apiMocks.apiFetch.mockResolvedValue(undefined);
    apiMocks.getCalendar.mockResolvedValue([{date:"2026-09-12",items:[canonical]}]);
    const onDayChange=vi.fn();
    render(<NextIntlClientProvider locale="en" messages={en}><TaskCard date="2026-09-12" item={item} timeZone="Africa/Cairo" onDayChange={onDayChange}/></NextIntlClientProvider>);

    expect(screen.getByRole("region",{name:"Manual time history"})).toBeInTheDocument();
    await user.click(screen.getByRole("button",{name:"Delete 45m entry"}));
    expect(screen.getByRole("dialog",{name:"Delete time entry?"})).toBeInTheDocument();
    await user.click(screen.getByRole("button",{name:"Delete"}));

    await waitFor(()=>expect(apiMocks.apiFetch).toHaveBeenCalledWith("/api/v1/time-entries",{method:"DELETE",body:JSON.stringify({id:"entry-1"})},expect.any(Function)));
    await waitFor(()=>expect(apiMocks.getCalendar).toHaveBeenCalledWith("2026-09-12","2026-09-12"));
    expect(onDayChange).toHaveBeenCalledWith({date:"2026-09-12",items:[canonical]});
  });

  it("does not delete when confirmation is cancelled",async()=>{
    const user=userEvent.setup();
    render(<NextIntlClientProvider locale="en" messages={en}><TaskCard date="2026-09-12" item={item}/></NextIntlClientProvider>);
    await user.click(screen.getByRole("button",{name:"Delete 45m entry"}));
    await user.click(screen.getByRole("button",{name:"Cancel"}));
    expect(apiMocks.apiFetch).not.toHaveBeenCalled();
  });

  it("posts a valid duration and applies the canonical server day",async()=>{
    const user=userEvent.setup();
    const canonical={...item,directMinutes:75,actualMinutes:75,remainingMinutes:45,percent:62.5,manualEntries:[{id:"entry-2",itemId:"item-1",date:"2026-09-12",minutes:30,source:"manual" as const,createdAt:"2026-09-12T21:00:00Z"},...item.manualEntries]};
    apiMocks.apiFetch.mockResolvedValue(canonical.manualEntries[0]);
    apiMocks.getCalendar.mockResolvedValue([{date:"2026-09-12",items:[canonical]}]);
    const onDayChange=vi.fn();
    render(<NextIntlClientProvider locale="en" messages={en}><TaskCard date="2026-09-12" item={item} onDayChange={onDayChange}/></NextIntlClientProvider>);
    await user.type(screen.getByRole("spinbutton",{name:"Minutes"}),"30");
    await user.click(screen.getByRole("button",{name:"Add"}));
    await waitFor(()=>expect(apiMocks.apiFetch).toHaveBeenCalledWith("/api/v1/time-entries",{method:"POST",body:JSON.stringify({itemId:"item-1",date:"2026-09-12",minutes:30})},expect.any(Function)));
    expect(onDayChange).toHaveBeenCalledWith({date:"2026-09-12",items:[canonical]});
  });
});
