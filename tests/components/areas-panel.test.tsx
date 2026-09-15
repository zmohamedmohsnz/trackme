import {cleanup,render,screen} from "@testing-library/react";
import {NextIntlClientProvider} from "next-intl";
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import ar from "../../messages/ar.json";
import en from "../../messages/en.json";

const mocks=vi.hoisted(()=>({getSettings:vi.fn()}));
vi.mock("../../components/api-client",()=>({...mocks}));
vi.mock("../../components/focus-item-manager",()=>({FocusItemManager:({timezone}:{timezone:string})=><div data-testid="focus-item-manager">{timezone}</div>}));
vi.mock("sonner",()=>({toast:{error:vi.fn()}}));

import {AreasPanel} from "../../components/areas-panel";

describe("AreasPanel",()=>{
  beforeEach(()=>{vi.clearAllMocks();mocks.getSettings.mockResolvedValue({locale:"en",timezone:"Africa/Cairo",weekStartsOn:6,onboardingStep:3,onboardingCompleted:true})});
  afterEach(cleanup);

  it.each([
    ["en",en,"Areas","Organize the areas and tasks that shape your weekly plan."],
    ["ar",ar,"المجالات","نظّم المجالات والمهام التي تشكّل خطتك الأسبوعية."],
  ])("loads the timezone and renders the localized %s page",async(locale,messages,title,description)=>{
    render(<div dir={locale==="ar"?"rtl":"ltr"}><NextIntlClientProvider locale={locale} messages={messages}><AreasPanel/></NextIntlClientProvider></div>);
    expect(await screen.findByRole("heading",{name:title})).toBeInTheDocument();
    expect(screen.getByText(description)).toBeInTheDocument();
    expect(screen.getByTestId("focus-item-manager")).toHaveTextContent("Africa/Cairo");
    expect(screen.getByRole("heading",{name:title}).closest("[dir]")).toHaveAttribute("dir",locale==="ar"?"rtl":"ltr");
  });
});
