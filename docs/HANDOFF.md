# TrackMe v1 implementation checkpoint

## Checkpoint purpose

This checkpoint now contains an integrated, locally verified TrackMe v1. The demo fallback remains available when Supabase public variables are absent, while the configured path uses real Auth, RLS-protected data, and canonical API contracts.

Original checkpoint: `db31a6b` (`feat: checkpoint trackme v1 foundation`).

## Completed

- Approved design committed in `docs/superpowers/specs/2026-09-12-personal-tracking-system-design.md`.
- Next.js 16.3.5 App Router foundation with strict TypeScript, Tailwind/shadcn tokens, English/Arabic routing, RTL, environment validation, Supabase SSR session refresh, and Vercel configuration.
- Supabase migration for all nine domain tables, same-owner foreign keys, constraints, indexes, explicit Data API grants, per-operation RLS, signup profile creation, and transactional completion/undo RPCs.
- `/api/v1` domain/API layer for settings, focus items, weekly plans, date overrides, calendar ranges, time entries, completion, and undo.
- Pure schedule/progress modules with unit tests.
- Responsive demo-capable UI for authentication, onboarding, Month/Week calendar, task progress actions, weekly planning, settings, and archives.
- Complete English and Arabic message catalogs.
- Canonical camelCase domain serialization shared by the UI, APIs, and demo fixtures.
- Resumable multi-area onboarding, real-ID weekly plans, live settings/archive restore, checklist mutations, completion/undo, and date/weekday-forward schedule editing.
- Language-neutral `/api/v1` proxy handling and corrected signup PKCE callback behavior.

## Verified at checkpoint

- `npm run verify`: lint, TypeScript, Vitest, and production build pass.
- `npm run db:reset` and `npm run db:test`: migration plus 21 pgTAP RLS/RPC assertions pass.
- Live API integration covers settings, account isolation, focus CRUD, planning, time, checklists, completion/undo, overrides, and archive/restore.
- Credentialed desktop/mobile Playwright covers onboarding, real plan rendering, signup confirmation, and password recovery; credential-free English/Arabic smoke tests retain demo coverage.
- `npm audit`: zero known vulnerabilities.

## Known incomplete work

1. Configure the actual Supabase and Vercel projects, Preview/Production public variables, SMTP, and redirect allowlists.
2. Push the migration to the linked hosted Supabase project and run a deployed smoke test. This requires the project/account credentials and deployed hostname; local build and live-backend verification are complete.

## Recommended continuation order

1. Link the production Supabase project and apply migrations.
2. Configure Vercel variables plus Supabase SMTP and redirect allowlists.
3. Run the credentialed smoke journeys on Preview, then promote to Production.

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
