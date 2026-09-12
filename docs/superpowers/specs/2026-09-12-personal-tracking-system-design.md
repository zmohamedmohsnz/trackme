# Personal Tracking System v1 Design

## Product goal

Build a responsive personal planning and progress-tracking web app. Users plan recurring duration goals, adjust individual dates, record actual time, and understand progress from a month or week calendar. The first release supports independent public accounts while intentionally excluding timers, native mobile, sharing, analytics, notifications, and offline mode.

## Experience

- Public email/password registration requires email verification. Protected users complete a resumable onboarding flow before entering the application.
- Onboarding captures interface language, IANA timezone, week-start day, focus areas, timed subtasks, checklist steps, weekdays, and duration targets.
- English and Arabic are first-class locales. System copy, dates, durations, validation, and layout direction are localized; user-entered names remain unchanged.
- Desktop Month and Week views place duration cards inside calendar days. Phone Month uses compact progress indicators with a selected-day sheet; phone Week uses a seven-day selector above stacked cards.
- Weekly Plan manages reusable schedules. Calendar edits explicitly target either one date or the selected weekday from that date forward.
- Settings manages locale, timezone, and week start. Areas are archived rather than destructively deleted.

## Scheduling and completion

- A focus area may contain one level of time-bearing subtasks. Areas and subtasks may contain non-time-bearing checklist steps.
- Effective-dated weekly plan versions preserve historical targets. Per-date overrides may add, resize, or skip an item without changing the weekly plan.
- A subtask is visible only when its parent is active. Skipping or archiving a parent suppresses its children.
- Checklist state resets per scheduled date and remains available historically.
- An area's progress is its direct time plus all subtask time. Actual totals may exceed the target; visual progress caps at 100%.
- An item is complete when its duration target is reached and all of its own checklist steps are complete.
- Mark Complete atomically fills only the missing duration and checks only the selected item's remaining steps. Undo removes only records created by that completion action.

## Architecture

- Next.js 16 App Router, TypeScript, shadcn/ui, and a custom calendar provide the responsive web experience.
- `next-intl` provides locale routing, messages, formatting, and LTR/RTL direction.
- Supabase provides public email/password Auth and PostgreSQL. Vercel hosts the Next.js UI and versioned API route handlers.
- The web client and future native clients share language-neutral `/api/v1` resources. Web authentication uses secure Supabase SSR cookies; future native clients use bearer sessions.
- Route handlers validate inputs and use the authenticated user's Supabase session. PostgreSQL row-level security independently isolates every exposed domain table.

## Data model

- `profiles`: user preferences and onboarding state.
- `focus_items`: areas and one-level subtasks, ordering, ownership, and archival state.
- `checklist_templates`: effective-dated reusable steps.
- `weekly_plan_versions` and `weekly_plan_entries`: effective scheduling snapshots.
- `date_overrides`: date-specific add, resize, or skip instructions.
- `time_entries`: positive whole-minute manual and completion-fill records.
- `daily_checklist_completions`: per-date manual or automatic step completion.
- `completion_actions`: idempotent grouping for atomic completion and undo.

Domain tables use UUID identifiers, ISO local dates for daily attribution, timezone-aware audit timestamps, ownership-preserving foreign keys, constraints, indexes, explicit Data API grants, and RLS policies matching `(select auth.uid()) = user_id`.

## API

- `GET/PATCH /api/v1/me/settings`
- `GET/POST/PATCH /api/v1/focus-items`
- `GET/PUT /api/v1/weekly-plan`
- `PUT/DELETE /api/v1/date-overrides/{date}/{itemId}`
- `GET /api/v1/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `POST/DELETE /api/v1/time-entries`
- `POST /api/v1/completion-actions`
- `DELETE /api/v1/completion-actions/{id}`

API errors use `{ "error": { "code": string, "message": string, "fieldErrors"?: object } }`. Date fields are ISO local dates and durations are integer minutes. Completion and undo are transactional and idempotent; other concurrent edits use last-write-wins and return canonical server state.

## Quality and delivery

- Unit tests cover schedule resolution, effective dates, overrides, rollups, checklist requirements, completion, and undo.
- Database tests cover constraints, indexes, RLS isolation, transactional behavior, and cross-user denial.
- API and browser tests cover authentication, onboarding, tracking, responsive layouts, locale switching, RTL, future-versus-date edits, archive behavior, and account isolation.
- Production delivery includes pinned dependencies, a committed lockfile, Supabase migrations/configuration, environment validation, Vercel configuration, and documented setup steps.

## Defaults

- Browser locale is used when supported, otherwise English.
- Browser timezone is captured during onboarding; week start defaults to Saturday.
- Duration targets and entries accept 1–1,440 whole minutes.
- Public accounts are independent: no teams, roles, sharing, or administration exist in v1.
- Renaming an item updates its label throughout the interface without rewriting historical durations or completion records.
