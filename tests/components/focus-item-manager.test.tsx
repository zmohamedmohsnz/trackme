import {cleanup,fireEvent,render,screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {NextIntlClientProvider} from "next-intl";
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {FocusItemManager} from "@/components/focus-item-manager";
import ar from "../../messages/ar.json";
import en from "../../messages/en.json";

const api=vi.hoisted(()=>({apiFetch:vi.fn(),getFocusItems:vi.fn()}));
vi.mock("@/components/api-client",()=>({...api,demoMode:false}));
vi.mock("sonner",()=>({toast:{success:vi.fn(),error:vi.fn()}}));

describe("FocusItemManager",()=>{
  beforeEach(()=>{vi.clearAllMocks();api.getFocusItems.mockResolvedValue([]);api.apiFetch.mockResolvedValue({})});
  afterEach(cleanup);
  it.each([
    ["en",en,"Focus areas and subtasks","Focus area name"],
    ["ar",ar,"مجالات التركيز والمهام الفرعية","اسم مجال التركيز"],
  ])("renders localized management controls in %s",async(locale,messages,title,areaLabel)=>{
    render(<div dir={locale==="ar"?"rtl":"ltr"}><NextIntlClientProvider locale={locale} messages={messages}><FocusItemManager timezone="Africa/Cairo"/></NextIntlClientProvider></div>);
    expect(await screen.findByText(title)).toBeInTheDocument();
    expect(screen.getByLabelText(areaLabel)).toBeInTheDocument();
    expect(screen.getByText(title).closest("[dir]")).toHaveAttribute("dir",locale==="ar"?"rtl":"ltr");
  });
  it("shows localized feedback for an overlong focus-area name",async()=>{
    const user=userEvent.setup();
    render(<NextIntlClientProvider locale="en" messages={en}><FocusItemManager timezone="Africa/Cairo"/></NextIntlClientProvider>);
    const input=await screen.findByLabelText("Focus area name");
    fireEvent.change(input,{target:{value:"x".repeat(201)}});await user.click(screen.getByRole("button",{name:"Add area"}));
    expect(screen.getByText("Enter a name between 1 and 200 characters.")).toBeInTheDocument();
    expect(input).toHaveAttribute("aria-invalid","true");
  });
  it("archives and restores the same focus item",async()=>{
    const user=userEvent.setup();
    const item={id:"00000000-0000-4000-8000-000000000001",kind:"area" as const,name:"Deep work",position:0,archivedAt:null,checklist:[]};
    api.getFocusItems.mockResolvedValue([item]);
    api.apiFetch.mockImplementation(async(_path:string,init:RequestInit)=>({...item,archivedAt:JSON.parse(String(init.body)).archived?"2026-09-13T00:00:00Z":null}));
    render(<NextIntlClientProvider locale="en" messages={en}><FocusItemManager timezone="Africa/Cairo"/></NextIntlClientProvider>);
    await user.click(await screen.findByRole("button",{name:"Archive"}));
    expect(await screen.findByText("Deep work")).toBeInTheDocument();
    await user.click(screen.getByRole("button",{name:"Restore"}));
    expect(api.apiFetch).toHaveBeenNthCalledWith(1,"/api/v1/focus-items",expect.objectContaining({method:"PATCH",body:JSON.stringify({id:item.id,archived:true})}),expect.any(Function));
    expect(api.apiFetch).toHaveBeenNthCalledWith(2,"/api/v1/focus-items",expect.objectContaining({method:"PATCH",body:JSON.stringify({id:item.id,archived:false})}),expect.any(Function));
  });
});
