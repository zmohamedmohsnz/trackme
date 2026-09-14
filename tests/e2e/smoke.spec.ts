import {test,expect} from "@playwright/test";
test.skip(Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),"Demo smoke tests require Supabase to be unconfigured.");
test("English demo calendar loads",async({page})=>{await page.goto("/en/calendar");await expect(page.getByRole("heading",{name:/september|october|november|december|january|february|march|april|may|june|july|august/i})).toBeVisible();await expect(page.getByText(/Demo mode/)).toBeVisible()});
test("Arabic layout is RTL",async({page})=>{await page.goto("/ar/calendar");await expect(page.locator("html")).toHaveAttribute("dir","rtl");await expect(page.locator("a:visible").filter({hasText:"التقويم"}).first()).toBeVisible()});
