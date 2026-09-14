import {cleanup,render,screen,waitFor} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {NextIntlClientProvider} from "next-intl";
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import en from "../../messages/en.json";

const mocks=vi.hoisted(()=>({apiFetch:vi.fn(),getFocusItems:vi.fn(),getSettings:vi.fn(),push:vi.fn()}));
vi.mock("../../components/api-client",()=>({...mocks,ApiClientError:class extends Error{},demoMode:false}));
vi.mock("next/navigation",()=>({useRouter:()=>({push:mocks.push})}));
vi.mock("sonner",()=>({toast:{success:vi.fn(),error:vi.fn()}}));

import {SettingsPanel} from "../../components/settings-panel";

describe("SettingsPanel language switching",()=>{
  beforeEach(()=>{vi.clearAllMocks();mocks.getSettings.mockResolvedValue({locale:"en",timezone:"Africa/Cairo",weekStartsOn:6,onboardingStep:3,onboardingCompleted:true});mocks.getFocusItems.mockResolvedValue([]);mocks.apiFetch.mockResolvedValue({})});
  afterEach(cleanup);

  it("persists the selected language and navigates to its localized route",async()=>{
    const user=userEvent.setup();
    render(<NextIntlClientProvider locale="en" messages={en}><SettingsPanel/></NextIntlClientProvider>);
    await user.selectOptions(await screen.findByRole("combobox",{name:"Language"}),"ar");
    await user.click(screen.getByRole("button",{name:"Save settings"}));
    await waitFor(()=>expect(mocks.apiFetch).toHaveBeenCalledWith("/api/v1/me/settings",expect.objectContaining({method:"PATCH",body:JSON.stringify({locale:"ar",timezone:"Africa/Cairo",weekStartsOn:6})}),expect.any(Function)));
    expect(mocks.push).toHaveBeenCalledWith("/ar/settings");
  });
});
