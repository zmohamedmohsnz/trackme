"use client";
import Link from "next/link";
import {usePathname,useRouter} from "next/navigation";
import {CalendarDays,ClipboardList,Settings,LogOut,Shapes,Sparkles} from "lucide-react";
import {useLocale,useTranslations} from "next-intl";
import {cn} from "@/lib/utils";
import {Button} from "./ui/button";
import {demoMode} from "./api-client";

export function AppShell({children}:{children:React.ReactNode}){
 const t=useTranslations("Nav"),locale=useLocale(),path=usePathname(),router=useRouter();
 const links=[{href:`/${locale}/calendar`,label:t("calendar"),icon:CalendarDays},{href:`/${locale}/weekly-plan`,label:t("weeklyPlan"),icon:ClipboardList},{href:`/${locale}/areas`,label:t("areas"),icon:Shapes},{href:`/${locale}/settings`,label:t("settings"),icon:Settings}];
 async function logout(){if(!demoMode){const {createClient}=await import("@/lib/supabase/client");await createClient().auth.signOut()}router.push(`/${locale}/login`);router.refresh()}
 return <div className="min-h-[calc(100vh-33px)] bg-muted/30 lg:grid lg:grid-cols-[240px_1fr]">
   <aside className="hidden border-e bg-background p-4 lg:flex lg:flex-col"><Link href={`/${locale}/calendar`} className="mb-8 flex items-center gap-2 px-2 text-lg font-semibold"><span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground"><Sparkles className="size-4"/></span>TrackMe</Link><nav className="space-y-1">{links.map(({href,label,icon:Icon})=><Link key={href} href={href as never} aria-current={path.startsWith(href)?"page":undefined} className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium",path.startsWith(href)?"bg-accent text-accent-foreground":"text-muted-foreground hover:bg-accent/60 hover:text-foreground")}><Icon className="size-4"/>{label}</Link>)}</nav><Button onClick={logout} variant="ghost" className="mt-auto justify-start text-muted-foreground"><LogOut className="size-4"/>{t("logout")}</Button></aside>
   <main className="min-w-0 pb-20 lg:pb-0">{children}</main>
   <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-background/95 px-2 py-2 backdrop-blur lg:hidden">{links.map(({href,label,icon:Icon})=><Link key={href} href={href as never} aria-current={path.startsWith(href)?"page":undefined} className={cn("flex min-w-0 flex-1 flex-col items-center gap-1 rounded-md px-1 py-1 text-[11px]",path.startsWith(href)?"text-foreground":"text-muted-foreground")}><Icon className="size-5"/><span>{label}</span></Link>)}</nav>
 </div>
}
