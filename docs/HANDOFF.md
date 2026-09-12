# TrackMe v1 implementation checkpoint

## Checkpoint purpose

This is a deliberate continuation boundary. The repository now contains a secure database/API foundation and a complete bilingual responsive UI prototype. The next session should integrate the two against a running local Supabase stack, then finish the remaining production workflows.

Checkpoint commit: `db31a6b` (`feat: checkpoint trackme v1 foundation`).

## Completed

- Approved design committed in `docs/superpowers/specs/2026-09-12-personal-tracking-system-design.md`.
- Next.js 16.3.5 App Router foundation with strict TypeScript, Tailwind/shadcn tokens, English/Arabic routing, RTL, environment validation, Supabase SSR session refresh, and Vercel configuration.
- Supabase migration for all nine domain tables, same-owner foreign keys, constraints, indexes, explicit Data API grants, per-operation RLS, signup profile creation, and transactional completion/undo RPCs.
- `/api/v1` domain/API layer for settings, focus items, weekly plans, date overrides, calendar ranges, time entries, completion, and undo.
- Pure schedule/progress modules with unit tests.
- Responsive demo-capable UI for authentication, onboarding, Month/Week calendar, task progress actions, weekly planning, settings, and archives.
- Complete English and Arabic message catalogs.

## Verified at checkpoint

- `npm run verify`: lint, TypeScript, 16 Vitest tests, and production build pass.
- `npx playwright test --workers=1 --reporter=line`: 4 desktop/mobile English/Arabic smoke tests pass when `npm run dev -- --hostname 127.0.0.1` is already running.
- `npm audit`: zero known vulnerabilities.
- Database migration and pgTAP files pass static checks.

## Known incomplete work

1. Live database verification is blocked until Docker Desktop's Linux engine is running. Run `npm run db:start`, `npm run db:reset`, and `npm run db:test`; resolve any migration or pgTAP failures before other integration work.
2. The UI and API were produced as parallel isolated workstreams and still need their wire formats unified:
   - API success responses are `{data: ...}` while `components/api-client.ts` and calendar code currently expect unwrapped/demo-shaped responses.
   - API mutations use `itemId`, `date`, `name`, `kind`, `durationMinutes`, and structured checklist inputs. Some UI calls still send `focusItemId`, `localDate`, `title`, `targetMinutes`, or onboarding convenience fields.
   - The API `CalendarItem` shape nests `item` and uses `actualMinutes`, `percent`, and checklist `completed`; the UI prototype uses flattened demo fields such as `title`, `directMinutes`, `contributedMinutes`, and checklist `done`.
3. Replace hard-coded demo item identifiers in Weekly Plan and onboarding with loaded/created focus-item IDs. Onboarding must support multiple areas, each subtask's own weekday schedule, and multiple checklist steps rather than only one initial item.
4. Wire Settings and archive restore to loaded profile/focus-item data. Support every week-start day, not only Saturday/Sunday/Monday.
5. Add calendar date-override editing for one-date add/resize/skip and the explicit “this weekday from this date forward” choice.
6. Add manual checklist toggle endpoints/behavior. The current API models checklist reads and completion-action auto-checking but does not expose a route for manually checking/unchecking a daily step.
7. After live Supabase integration, add credentialed Playwright coverage for registration verification, password reset, onboarding resume, account isolation, completion/undo, weekly-versus-date edits, and archive/restore.
8. Configure actual Supabase and Vercel projects, environment variables, SMTP/redirect allowlists, then perform a deployment smoke test.

## Recommended continuation order

1. Start Docker and prove the migration/RLS/RPC suite.
2. Define one canonical camelCase API response adapter and make the UI consume the shared `types/domain.ts` contracts; remove the separate demo-only type model.
3. Complete onboarding and Weekly Plan CRUD using real focus-item IDs.
4. Add daily checklist mutation and date-override UI/API integration.
5. Run the full real-backend browser journeys, then configure and smoke-test deployment.

## Commands

```text
npm install
npm run db:start
npm run db:reset
npm run db:test
npm run verify
npm run dev -- --hostname 127.0.0.1
npx playwright test --workers=1 --reporter=line
```

Supabase is intentionally optional for the demo UI build. Copy `.env.example` to `.env.local` and populate only the project URL and publishable key; never put a service-role or secret key in a public variable.
