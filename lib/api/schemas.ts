import { z } from "zod";

export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be an ISO date (YYYY-MM-DD).");
export const durationSchema = z.number().int().min(1).max(1440);
export const uuidSchema = z.string().uuid();

export const settingsPatchSchema = z.object({
  locale: z.enum(["en", "ar"]).optional(),
  timezone: z.string().min(1).max(100).optional(),
  weekStartsOn: z.number().int().min(0).max(6).optional(),
  onboardingCompleted: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, "At least one setting is required.");

const checklistInput = z.object({
  id: uuidSchema.optional(),
  label: z.string().trim().min(1).max(200),
  position: z.number().int().min(0),
  effectiveFrom: isoDateSchema,
  effectiveTo: isoDateSchema.nullable().optional(),
});

export const focusItemCreateSchema = z.object({
  kind: z.enum(["area", "subtask"]),
  parentId: uuidSchema.nullable().optional(),
  name: z.string().trim().min(1).max(200),
  position: z.number().int().min(0).default(0),
  checklist: z.array(checklistInput).default([]),
}).superRefine((value, context) => {
  if (value.kind === "subtask" && !value.parentId) context.addIssue({ code: "custom", path: ["parentId"], message: "A subtask requires a parent area." });
  if (value.kind === "area" && value.parentId) context.addIssue({ code: "custom", path: ["parentId"], message: "An area cannot have a parent." });
});

export const focusItemPatchSchema = z.object({
  id: uuidSchema,
  name: z.string().trim().min(1).max(200).optional(),
  position: z.number().int().min(0).optional(),
  archived: z.boolean().optional(),
  checklist: z.array(checklistInput).optional(),
});

export const weeklyPlanSchema = z.object({
  effectiveFrom: isoDateSchema,
  entries: z.array(z.object({ itemId: uuidSchema, weekday: z.number().int().min(0).max(6), durationMinutes: durationSchema })),
});

export const dateOverrideSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("skip") }),
  z.object({ operation: z.enum(["add", "resize"]), durationMinutes: durationSchema }),
]);

export const timeEntryCreateSchema = z.object({ itemId: uuidSchema, date: isoDateSchema, minutes: durationSchema });
export const timeEntryDeleteSchema = z.object({ id: uuidSchema });
export const completionActionSchema = z.object({ itemId: uuidSchema, date: isoDateSchema, idempotencyKey: z.string().min(8).max(200) });
