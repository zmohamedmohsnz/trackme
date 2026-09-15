import {cleanup,render,screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {NextIntlClientProvider} from "next-intl";
import {afterEach,beforeEach,describe,expect,it} from "vitest";
import en from "../../messages/en.json";
import ar from "../../messages/ar.json";
import {ThemeToggle} from "../../components/theme-toggle";
import {THEME_STORAGE_KEY} from "../../lib/theme";

describe("ThemeToggle",()=>{
  beforeEach(()=>{
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });
  afterEach(cleanup);

  it("persists dark mode and restores light mode",async()=>{
    const user=userEvent.setup();
    render(<NextIntlClientProvider locale="en" messages={en}><ThemeToggle/></NextIntlClientProvider>);

    const toggle=screen.getByRole("button",{name:"Theme"});
    await user.click(toggle);
    expect(document.documentElement).toHaveClass("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(toggle).toHaveAttribute("aria-pressed","true");

    await user.click(toggle);
    expect(document.documentElement).not.toHaveClass("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });

  it("exposes an Arabic accessible label",()=>{
    render(<div dir="rtl"><NextIntlClientProvider locale="ar" messages={ar}><ThemeToggle/></NextIntlClientProvider></div>);
    expect(screen.getByRole("button",{name:"السمة"})).toBeInTheDocument();
  });
});
