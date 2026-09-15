import {cleanup,render,screen} from "@testing-library/react";
import {NextIntlClientProvider} from "next-intl";
import {afterEach,describe,expect,it,vi} from "vitest";
import ar from "../../messages/ar.json";
import en from "../../messages/en.json";

const navigation=vi.hoisted(()=>({path:"/en/areas",push:vi.fn(),refresh:vi.fn()}));
vi.mock("next/navigation",()=>({usePathname:()=>navigation.path,useRouter:()=>({push:navigation.push,refresh:navigation.refresh})}));

import {AppShell} from "../../components/app-shell";

describe("AppShell Areas navigation",()=>{
  afterEach(cleanup);
  it.each([["en",en,"Areas"],["ar",ar,"المجالات"]])("links to Areas in desktop and mobile navigation for %s",(locale,messages,label)=>{
    navigation.path=`/${locale}/areas`;
    render(<NextIntlClientProvider locale={locale} messages={messages}><AppShell><div>Content</div></AppShell></NextIntlClientProvider>);
    const links=screen.getAllByRole("link",{name:label});
    expect(links).toHaveLength(2);
    for(const link of links){expect(link).toHaveAttribute("href",`/${locale}/areas`);expect(link).toHaveAttribute("aria-current","page")}
  });
});
