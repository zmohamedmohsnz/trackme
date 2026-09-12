import { describe, expect, it } from "vitest";
import { focusItemCreateSchema, timeEntryCreateSchema } from "@/lib/api/schemas";

describe("API validation", () => {
  it("enforces duration bounds and whole minutes", () => {
    expect(timeEntryCreateSchema.safeParse({ itemId: crypto.randomUUID(), date: "2026-01-01", minutes: 0 }).success).toBe(false);
    expect(timeEntryCreateSchema.safeParse({ itemId: crypto.randomUUID(), date: "2026-01-01", minutes: 1.5 }).success).toBe(false);
    expect(timeEntryCreateSchema.safeParse({ itemId: crypto.randomUUID(), date: "2026-01-01", minutes: 1440 }).success).toBe(true);
  });
  it("requires a parent for subtasks", () => expect(focusItemCreateSchema.safeParse({ kind: "subtask", name: "Run", checklist: [] }).success).toBe(false));
});
