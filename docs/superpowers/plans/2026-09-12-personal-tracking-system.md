# Personal Tracking System v1 Implementation Plan

## Summary

Build a responsive, bilingual personal tracking web app using Next.js 16, TypeScript, shadcn/ui, Supabase Auth/PostgreSQL, and Vercel.

Users register publicly with verified email/password accounts, complete a guided setup, and track flexible duration goals through Month and Week calendar views. The architecture remains multi-user and mobile-ready, while excluding timers, native mobile, sharing, analytics, notifications, and offline support.

## Key Changes

### Application and experience

- Scaffold the missing Next.js App Router foundation around the existing shadcn theme; use a custom duration-card calendar rather than appointment-oriented calendar software.
- Add `/en` and `/ar` interfaces using `next-intl`, setting `lang`, LTR/RTL direction, localized dates, durations, validation, and system messages.
- Implement Supabase registration, email verification, login, logout, password reset, secure SSR cookie refresh, and protected application routes.
- Add resumable onboarding for locale, timezone, week start, focus areas, weekday durations, timed subtasks, and reusable checklist steps.
- Provide:
  - Desktop Month and Week grids with duration cards.
  - Phone Month grid with compact progress indicators and a selected-day detail sheet.
  - Phone Week view with a seven-day selector and stacked daily cards.
  - Weekly Plan, Settings, archive management, manual time-entry, completion, and undo flows.
- Preserve user-entered task names exactly; default locale from the browser with English fallback, timezone from the browser, and week start to Saturday.
- Add `.superpowers/` to `.gitignore`; document the durable API-first, localization, Supabase, and RLS conventions in `AGENTS.md`.

### Scheduling and progress model

- Model one-level `focus_items`: top-level areas and time-bearing subtasks. Either can have non-time-bearing checklist templates.
- Store effective-dated weekly-plan snapshots. Updating a weekday creates or updates the plan version effective from the selected date, preserving historical targets.
- Overlay per-date exceptions that add, resize, or skip an item without changing the weekly plan.
- Allow subtasks only on dates where their parent is active. Skipping or archiving a parent suppresses its children.
- Reset checklist state for each scheduled date while preserving past results.
- Calculate parent progress as direct parent time plus all subtask time. Preserve over-target totals while capping the visual progress bar at 100%.
- Define completion as reaching the duration target and completing that item’s own checklist.
- “Mark complete” atomically:
  - Adds an identifiable automatic entry for the missing combined duration.
  - Checks the selected item’s remaining checklist steps.
  - Does not complete descendant checklists.
- Undo removes only the automatic entry and automatically checked steps from that completion action.
- Archive areas and subtasks instead of deleting their history.

### Database and security

Create Supabase migrations for:

- `profiles`: locale, IANA timezone, week-start day, and onboarding status.
- `focus_items`: owner, area/subtask kind, parent, ordering, and archival state.
- `checklist_templates`: effective-dated reusable steps.
- `weekly_plan_versions` and `weekly_plan_entries`: effective scheduling snapshots.
- `date_overrides`: one-date additions, duration changes, and skips.
- `time_entries`: positive integer minutes with `manual` or `completion_fill` source.
- `daily_checklist_completions`: manual or completion-action state by local date.
- `completion_actions`: idempotent grouping for atomic completion and undo.

Use UUID identifiers, timezone-aware audit timestamps, ISO local dates for daily attribution, positive-minute constraints, composite ownership foreign keys, and indexes for user/date, parent, plan-version, and foreign-key access paths.

Enable RLS on every exposed table. All select/insert/update/delete policies must require `(select auth.uid()) = user_id`, including `WITH CHECK` for writes. Use only the publishable key in clients; never expose secret or service-role keys. Implement completion and undo through transactional, security-invoker database functions with explicit ownership validation.

## Public API and Types

Expose language-neutral Next.js route handlers under `/api/v1`:

- `GET/PATCH /me/settings`
- `GET/POST/PATCH /focus-items`, including checklist maintenance and archival
- `GET/PUT /weekly-plan`, accepting a complete plan snapshot and `effectiveFrom`
- `PUT/DELETE /date-overrides/{date}/{itemId}`
- `GET /calendar?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `POST/DELETE /time-entries`
- `POST /completion-actions` and `DELETE /completion-actions/{id}`

Core contracts:

- `FocusItem`: area/subtask identity, parent, name, ordering, and archive state.
- `WeeklyPlan`: effective date plus weekday/item target minutes.
- `DateOverride`: date, item, action, and optional replacement target.
- `TimeEntry`: item, local date, minutes, source, and audit timestamp.
- `CalendarItem`: target, direct time, contributed subtask time, total, remaining, checklist counts, completion, and nested subtasks.
- Errors: `{ error: { code, message, fieldErrors? } }`.

Validate names after trimming; accept positive whole-minute targets and entries up to 1,440 minutes. Completion endpoints are idempotent. Other multi-device edits use last-write-wins and return refreshed canonical resources.

## Testing and Delivery

- Unit-test recurrence resolution, effective plan changes, overrides, parent rollups, over-target totals, checklist requirements, completion, and undo.
- Database-test constraints, ownership relationships, RLS isolation for every operation, transactional rollback, idempotency, and query indexes.
- API-test authentication, payload validation, date/timezone handling, error contracts, and cross-user denial.
- Component-test duration input, planning, archive flows, locale switching, and RTL layout.
- Run Playwright journeys for registration/verification, onboarding, Month/Week tracking, one-date versus future changes, phone layouts, password reset, and cross-account isolation.
- Run Supabase migrations and database advisors, then verify type-checking, tests, production build, and environment-variable validation.
- Configure Vercel deployment and Supabase production redirect URLs, using pinned dependencies and a committed lockfile.
- Save the approved design in `docs/superpowers/specs/2026-09-12-personal-tracking-system-design.md`, self-review it for ambiguity and consistency, and commit it before implementation.

## Assumptions

- Public registration creates independent personal accounts; there are no teams, sharing, roles, or administration in v1.
- Email verification is required before onboarding.
- Weekly changes affect the selected weekday from the chosen date onward; date exceptions never modify the reusable plan.
- Renaming an item updates its displayed name across history, while durations, checklist results, and time entries remain unchanged.
- The responsive web app requires connectivity and is browser-based; installable PWA behavior and the native mobile client remain future work.

## Review Usage

Use this document as the implementation checklist during development and as the acceptance baseline during code review. Compare it with the more explanatory design specification and the current checkpoint handoff:

- `docs/superpowers/specs/2026-09-12-personal-tracking-system-design.md`
- `docs/HANDOFF.md`
