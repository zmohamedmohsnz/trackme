"use client";
import {FlaskConical} from "lucide-react";
import {useTranslations} from "next-intl";
import {demoMode} from "./api-client";
export function DemoBanner(){const t=useTranslations("Common");if(!demoMode)return null;return <div className="flex items-center justify-center gap-2 border-b bg-secondary px-4 py-2 text-xs text-muted-foreground"><FlaskConical className="size-3.5"/><span>{t("demoMode")}</span></div>}
