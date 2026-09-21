import { z } from "zod";
import { isIsoDate } from "@/lib/domain/dates";

export const isoDateSchema = z.string().refine(isIsoDate, "Must be a valid ISO date (YYYY-MM-DD).");
export const durationSchema = z.number().int().min(1).max(1440);
export const uuidSchema = z.string().uuid();

const preservedNameSchema = z.string().refine(
  (value) => value.trim().length >= 1 && value.trim().length <= 200,
  "Must contain between 1 and 200 non-whitespace characters.",
);
const timezoneSchema = z.string().refine((value) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}, "Must be a valid IANA timezone.");

const weekdaySchema = z.number().int().min(0).max(6);
const onboardingDraftItemSchema = z.object({
  clientId: z.string().min(1).max(100),
  areaClientId: z.string().min(1).max(100).nullable().optional(),
  name: z.string().max(200),
  checklist: z.array(z.string().max(200)).max(50),
  weekdays: z.array(weekdaySchema).max(7).refine((days) => new Set(days).size === days.length, "Weekdays must be unique."),
  target: z.string().max(10),
});

export const onboardingDraftSchema = z.object({
  language: z.enum(["en", "ar"]),
  timezone: z.string().max(100),
  weekStart: weekdaySchema,
  areas: z.array(z.object({clientId:z.string().min(1).max(100),name:z.string().max(200)})).max(100),
  tasks: z.array(onboardingDraftItemSchema).max(100),
}).superRefine((draft, context) => {
  const ids = new Set<string>();
  const areas = new Set(draft.areas.map((area) => area.clientId));
  for(const [index,area] of draft.areas.entries()){if(ids.has(area.clientId))context.addIssue({code:"custom",path:["areas",index,"clientId"],message:"Client ids must be unique."});ids.add(area.clientId)}
  draft.tasks.forEach((item, index) => {
    if (ids.has(item.clientId)) context.addIssue({code:"custom",path:["tasks",index,"clientId"],message:"Client ids must be unique."});
    ids.add(item.clientId);
    if (item.areaClientId && !areas.has(item.areaClientId)) context.addIssue({code:"custom",path:["tasks",index,"areaClientId"],message:"The selected area does not exist in the draft."});
  });
});

export const onboardingSaveSchema = z.object({step:z.number().int().min(0).max(2),draft:onboardingDraftSchema});
export const onboardingFinalizeSchema = z.object({effectiveFrom:isoDateSchema,draft:onboardingDraftSchema}).superRefine((value, context) => {
  if(!timezoneSchema.safeParse(value.draft.timezone).success)context.addIssue({code:"custom",path:["draft","timezone"],message:"Must be a valid IANA timezone."});
  const namedAreas = new Set(value.draft.areas.filter((item) => item.name.trim()).map((item) => item.clientId));
  if (!value.draft.tasks.some(item=>item.name.trim())) context.addIssue({code:"custom",path:["draft","tasks"],message:"At least one named task is required."});
  value.draft.areas.forEach((area,index)=>{if(area.name.trim()&&!preservedNameSchema.safeParse(area.name).success)context.addIssue({code:"custom",path:["draft","areas",index,"name"],message:"Must contain between 1 and 200 non-whitespace characters."})});
  value.draft.tasks.forEach((item,index) => {
    if (!item.name.trim()) return;
    if (item.areaClientId && !namedAreas.has(item.areaClientId)) context.addIssue({code:"custom",path:["draft","tasks",index,"areaClientId"],message:"A named task requires a named area or no area."});
    if (!preservedNameSchema.safeParse(item.name).success) context.addIssue({code:"custom",path:["draft","tasks",index,"name"],message:"Must contain between 1 and 200 non-whitespace characters."});
    const minutes=Number(item.target);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) context.addIssue({code:"custom",path:["draft","tasks",index,"target"],message:"Must be a whole number from 1 to 1440."});
    item.checklist.forEach((label,stepIndex)=>{if(label.trim()&&!preservedNameSchema.safeParse(label).success)context.addIssue({code:"custom",path:["draft","tasks",index,"checklist",stepIndex],message:"Must contain between 1 and 200 non-whitespace characters."})});
  });
});

export const settingsPatchSchema = z.object({
  locale: z.enum(["en", "ar"]).optional(),
  timezone: timezoneSchema.optional(),
  weekStartsOn: z.number().int().min(0).max(6).optional(),
  onboardingStep: z.number().int().min(0).max(3).optional(),
  onboardingCompleted: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, "At least one setting is required.");

const checklistInput = z.object({
  id: uuidSchema.optional(),
  label: preservedNameSchema,
  position: z.number().int().min(0),
  effectiveFrom: isoDateSchema,
  effectiveTo: isoDateSchema.nullable().optional(),
}).refine((value) => !value.effectiveTo || value.effectiveTo >= value.effectiveFrom, {
  message: "The end date cannot precede the start date.",
  path: ["effectiveTo"],
});

const checklistOperationSchema = z.discriminatedUnion("operation", [
  z.object({
    operation: z.literal("add"),
    label: preservedNameSchema,
    position: z.number().int().min(0),
    effectiveFrom: isoDateSchema,
  }),
  z.object({
    operation: z.literal("revise"),
    id: uuidSchema,
    label: preservedNameSchema,
    position: z.number().int().min(0),
    effectiveFrom: isoDateSchema,
  }),
  z.object({
    operation: z.literal("retire"),
    id: uuidSchema,
    effectiveFrom: isoDateSchema,
  }),
]);

export const focusItemCreateSchema = z.object({
  areaId: uuidSchema.nullable().optional(),
  name: preservedNameSchema,
  position: z.number().int().min(0).default(0),
  checklist: z.array(checklistInput).default([]),
});

export const focusItemPatchSchema = z.object({
  id: uuidSchema,
  name: preservedNameSchema.optional(),
  areaId: uuidSchema.nullable().optional(),
  position: z.number().int().min(0).optional(),
  archived: z.boolean().optional(),
  checklistOperations: z.array(checklistOperationSchema).min(1).optional(),
}).refine((value) => Object.keys(value).some((key) => key !== "id"), "At least one change is required.");

export const areaCreateSchema=z.object({name:preservedNameSchema,position:z.number().int().min(0).default(0)});
export const areaPatchSchema=z.object({id:uuidSchema,name:preservedNameSchema.optional(),position:z.number().int().min(0).optional(),archived:z.boolean().optional()}).refine(value=>Object.keys(value).some(key=>key!=="id"),"At least one change is required.");
export const areaDeleteSchema=z.object({id:uuidSchema});
export const areaGoalUpsertSchema=z.object({areaId:uuidSchema,period:z.enum(["day","week","month","year"]),targetMinutes:z.number().int().positive()});
export const areaGoalDeleteSchema=z.object({id:uuidSchema});

export const weeklyPlanSchema = z.object({
  effectiveFrom: isoDateSchema,
  entries: z.array(z.object({ itemId: uuidSchema, weekday: z.number().int().min(0).max(6), durationMinutes: durationSchema })),
}).superRefine((value, context) => {
  const seen = new Set<string>();
  value.entries.forEach((entry, index) => {
    const key = `${entry.itemId}:${entry.weekday}`;
    if (seen.has(key)) context.addIssue({ code: "custom", path: ["entries", index], message: "Each item may appear only once per weekday." });
    seen.add(key);
  });
});

export const dateOverrideSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("skip") }),
  z.object({ operation: z.enum(["add", "resize"]), durationMinutes: durationSchema }),
]);

export const timeEntryCreateSchema = z.object({ itemId: uuidSchema, date: isoDateSchema, minutes: durationSchema });
export const timeEntryDeleteSchema = z.object({ id: uuidSchema });
export const completionActionSchema = z.object({ itemId: uuidSchema, date: isoDateSchema, idempotencyKey: z.string().min(8).max(200) });
