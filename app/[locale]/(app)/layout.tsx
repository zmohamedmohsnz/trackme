import {redirect} from "next/navigation";
import {AppShell} from "@/components/app-shell";
import {isSupabaseConfigured} from "@/lib/env";
import {createClient} from "@/lib/supabase/server";

export default async function ProtectedLayout({children,params}:{children:React.ReactNode;params:Promise<{locale:string}>}){
  if(isSupabaseConfigured){
    const [{locale},supabase]=await Promise.all([params,createClient()]);
    const {data:{user}}=await supabase.auth.getUser();
    if(!user)redirect(`/${locale}/login`);
    const {data:profile}=await supabase.from("profiles").select("onboarding_completed_at").eq("user_id",user.id).single();
    if(!profile?.onboarding_completed_at)redirect(`/${locale}/onboarding`);
  }
  return <AppShell>{children}</AppShell>;
}
