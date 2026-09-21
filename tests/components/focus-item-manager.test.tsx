import {cleanup,render,screen,waitFor} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {NextIntlClientProvider} from "next-intl";
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {FocusItemManager} from "@/components/focus-item-manager";
import ar from "../../messages/ar.json";import en from "../../messages/en.json";
const api=vi.hoisted(()=>({apiFetch:vi.fn(),getFocusItems:vi.fn(),getAreas:vi.fn(),getAreaGoals:vi.fn()}));
vi.mock("@/components/api-client",()=>({...api,demoMode:false}));vi.mock("sonner",()=>({toast:{success:vi.fn(),error:vi.fn()}}));
const area={id:"00000000-0000-4000-8000-000000000001",name:"Deep work",position:0,archivedAt:null};
const task={id:"00000000-0000-4000-8000-000000000002",areaId:null,name:"Reading",position:0,archivedAt:null,checklist:[]};
function mount(locale="en"){return render(<div dir={locale==="ar"?"rtl":"ltr"}><NextIntlClientProvider locale={locale} messages={locale==="ar"?ar:en}><FocusItemManager timezone="Africa/Cairo"/></NextIntlClientProvider></div>)}
describe("FocusItemManager",()=>{beforeEach(()=>{vi.clearAllMocks();api.getAreas.mockResolvedValue([area]);api.getAreaGoals.mockResolvedValue([]);api.getFocusItems.mockResolvedValue([task]);api.apiFetch.mockImplementation(async(path:string,init?:RequestInit)=>{if(!init)return [];return {name:path.includes("focus-items")?task.name:area.name,...JSON.parse(String(init.body)),id:path.includes("goals")?"goal-1":path.includes("focus-items")?task.id:area.id,position:0,archivedAt:null,actualMinutes:0,percent:0,checklist:[]}})});afterEach(cleanup);
it.each([["en","Area name","Unassigned"],["ar","اسم المجال","غير مصنفة"]])("renders localized category and unassigned task in %s",async(locale,label,unassigned)=>{mount(locale);expect(await screen.findByLabelText(label)).toBeInTheDocument();expect(screen.getAllByText(unassigned).length).toBeGreaterThan(0);expect(screen.getByDisplayValue("Reading")).toBeInTheDocument();expect(screen.getByDisplayValue("Reading").closest("[dir]")).toHaveAttribute("dir",locale==="ar"?"rtl":"ltr")});
it("creates a task without an area",async()=>{const user=userEvent.setup();mount();await user.type(await screen.findByRole("textbox",{name:"Task name"}),"Run");await user.click(screen.getByRole("button",{name:"Add task"}));expect(api.apiFetch).toHaveBeenCalledWith("/api/v1/focus-items",expect.objectContaining({method:"POST",body:expect.stringContaining('"areaId":null')}))});
it("moves a task to an area",async()=>{const user=userEvent.setup();mount();await screen.findByDisplayValue("Reading");await user.click(screen.getAllByRole("combobox",{name:"Area"})[1]);await user.click(screen.getByRole("option",{name:"Deep work"}));await waitFor(()=>expect(api.apiFetch).toHaveBeenCalledWith("/api/v1/focus-items",expect.objectContaining({method:"PATCH",body:expect.stringContaining(`"areaId":"${area.id}"`)})));});
it("offers four independent goals",async()=>{mount();await screen.findByText("Deep work");for(const label of ["Daily","Weekly","Monthly","Yearly"])expect(screen.getByText(label)).toBeInTheDocument()});
});
