# TrackMe

TrackMe is a bilingual personal planning and progress tracker. It combines recurring duration goals, timed subtasks, reusable checklists, manual time entries, and date-specific plan changes in responsive Month and Week calendar views.

## Stack

- Next.js App Router and TypeScript
- shadcn/ui-compatible Tailwind design tokens
- Supabase Auth and PostgreSQL with row-level security
- `next-intl` for English and Arabic
- Vitest, Testing Library, and Playwright
- Vercel deployment

## Local setup

Requirements: Node.js 22.19 or newer, npm, Docker Desktop for the local Supabase stack, and a Supabase project for hosted authentication.

1. Install pinned dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and enter the Supabase project URL and publishable key. Never place a secret or service-role key in a `NEXT_PUBLIC_` variable.
3. Start local Supabase with `npx supabase start`, then apply migrations with `npx supabase db reset`.
4. Run the web app with `npm run dev` and open `http://localhost:3000`.

For hosted Supabase, push the committed migrations through the Supabase CLI after linking the project. In Authentication settings, enable email/password registration, require email confirmation, and allow these redirect URLs:

- `http://localhost:3000/en/auth/callback`
- `http://localhost:3000/ar/auth/callback`
- The matching `/en/auth/callback` and `/ar/auth/callback` URLs on the production domain

## Verification

```text
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Database tests require the local Supabase stack. Playwright authentication journeys require dedicated test users or a local Auth instance; credential-free UI smoke tests run against the application shell.

## Deployment

Create a Vercel project from this repository and configure `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for Preview and Production. Apply database migrations before promoting a deployment, and update Supabase Auth redirect allowlists for every deployed hostname.

The API lives under `/api/v1` and uses language-neutral ISO local dates plus integer minutes so a future mobile client can share the same backend behavior.
