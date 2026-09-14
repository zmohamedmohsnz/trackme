import {cleanup,render,screen,waitFor} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {NextIntlClientProvider} from "next-intl";
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import en from "../../messages/en.json";
import {OnboardingWizard} from "../../components/onboarding-wizard";

const push=vi.fn();
const apiFetch=vi.fn();

vi.mock("next/navigation",()=>({useRouter:()=>({push})}));
vi.mock("sonner",()=>({toast:{success:vi.fn(),error:vi.fn()}}));
vi.mock("@/lib/supabase/client",()=>({createClient:()=>({auth:{getUser:vi.fn().mockResolvedValue({data:{user:{id:"user-1"}}})}})}));
vi.mock("@/components/api-client",()=>({
  demoMode:false,
  getSettings:vi.fn().mockResolvedValue({locale:"en",timezone:"Africa/Cairo",weekStartsOn:6,onboardingStep:1,onboardingCompleted:false}),
  apiFetch:(...args:unknown[])=>apiFetch(...args),
}));

describe("OnboardingWizard",()=>{
  afterEach(cleanup);
  beforeEach(()=>{
    push.mockReset();
    apiFetch.mockReset();
    apiFetch.mockImplementation((path:string,init?:RequestInit)=>{
      if(path==="/api/v1/onboarding"&&!init)return Promise.resolve({step:1,completed:false,draft:{
        language:"en",timezone:"Africa/Cairo",weekStart:6,items:[
          {clientId:"area",kind:"area",name:"Deep work",checklist:["Review"],weekdays:[1,3],target:"90"},
          {clientId:"child",kind:"subtask",parentClientId:"area",name:"Reading",checklist:[],weekdays:[1,3],target:"30"},
        ],
      }});
      if(init?.method==="POST")return Promise.resolve({settings:{locale:"en",timezone:"Africa/Cairo",weekStartsOn:6,onboardingStep:3,onboardingCompleted:true},items:[],plans:[]});
      return Promise.resolve({});
    });
  });

  it("restores the server draft and submits one transactional finalization request",async()=>{
    const user=userEvent.setup();
    render(<NextIntlClientProvider locale="en" messages={en}><OnboardingWizard/></NextIntlClientProvider>);
    expect(await screen.findByDisplayValue("Deep work")).toBeInTheDocument();
    await user.click(screen.getByRole("button",{name:"Continue"}));
    await user.click(await screen.findByRole("button",{name:"Finish setup"}));
    await waitFor(()=>expect(push).toHaveBeenCalledWith("/en/calendar"));
    const finalizations=apiFetch.mock.calls.filter(([path,init])=>path==="/api/v1/onboarding"&&(init as RequestInit | undefined)?.method==="POST");
    expect(finalizations).toHaveLength(1);
    expect(JSON.parse((finalizations[0][1] as RequestInit).body as string)).toMatchObject({draft:{items:[{name:"Deep work"},{name:"Reading"}]}});
  });

  it("shows a field-level duration error before finalization",async()=>{
    const user=userEvent.setup();
    render(<NextIntlClientProvider locale="en" messages={en}><OnboardingWizard/></NextIntlClientProvider>);
    expect(await screen.findByDisplayValue("Deep work")).toBeInTheDocument();
    await user.click(screen.getByRole("button",{name:"Continue"}));
    const duration=await screen.findByRole("spinbutton",{name:"Deep work Daily target (minutes)"});
    await user.clear(duration);await user.type(duration,"0");await user.click(screen.getByRole("button",{name:"Finish setup"}));
    expect(screen.getByText("Enter a whole number from 1 to 1,440 minutes.")).toBeInTheDocument();
    expect(duration).toHaveAttribute("aria-invalid","true");
  });

  it("returns to the preference step and shows an invalid timezone inline",async()=>{
    const user=userEvent.setup();
    apiFetch.mockImplementation((path:string,init?:RequestInit)=>{
      if(path==="/api/v1/onboarding"&&!init)return Promise.resolve({step:0,completed:false,draft:{language:"en",timezone:"Mars/Olympus",weekStart:6,items:[{clientId:"area",kind:"area",name:"Deep work",checklist:[],weekdays:[1],target:"60"}]}});
      return Promise.resolve({});
    });
    render(<NextIntlClientProvider locale="en" messages={en}><OnboardingWizard/></NextIntlClientProvider>);
    expect(await screen.findByDisplayValue("Mars/Olympus")).toBeInTheDocument();
    await user.click(screen.getByRole("button",{name:"Continue"}));
    await user.click(await screen.findByRole("button",{name:"Continue"}));
    await user.click(await screen.findByRole("button",{name:"Finish setup"}));
    const timezone=await screen.findByRole("textbox",{name:"Timezone"});
    expect(screen.getByText("Enter a valid IANA timezone.")).toBeInTheDocument();
    expect(timezone).toHaveAttribute("aria-invalid","true");
  });
});
