import "@/app/globals.css";
import {NextIntlClientProvider,hasLocale} from "next-intl";
import {getMessages} from "next-intl/server";
import {notFound} from "next/navigation";
import {Toaster} from "sonner";
import {routing} from "@/i18n/routing";
import {DemoBanner} from "@/components/demo-banner";

export default async function LocaleLayout({children,params}:{children:React.ReactNode;params:Promise<{locale:string}>}){
  const {locale}=await params;if(!hasLocale(routing.locales,locale))notFound();
  const messages=await getMessages();
  return <html lang={locale} dir={locale==="ar"?"rtl":"ltr"}><body><NextIntlClientProvider messages={messages}><DemoBanner/>{children}<Toaster position={locale==="ar"?"bottom-left":"bottom-right"}/></NextIntlClientProvider></body></html>
}
