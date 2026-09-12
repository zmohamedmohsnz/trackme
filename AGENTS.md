# UI Design Rules

- This project uses shadcn/ui as its primary design system.
- The project was initialized using the following preset: `b3ZOb4v5M3`

When creating or modifying UI:

- Follow the existing shadcn theme, typography, spacing, radius, colors, and component styles.
- Prefer existing shadcn/ui components before creating custom components.
- Inspect existing components in the project before designing new ones.
- Keep new UI visually consistent with the existing application.
- Do not introduce another UI library unless explicitly requested.
- Do not hardcode arbitrary colors, spacing, border radii, shadows, or typography when an existing design token/style can be used.
- Compose existing components to create new screens instead of rebuilding common UI primitives.
- Use the shadcn registry/MCP to search for suitable components when needed.

The preset is a design foundation, not a limitation. Custom layouts and components are allowed, but they must visually belong to the same design system.

# General Rules

- Always use Context7 when I need library/API documentation, code generation, setup or configuration steps without me having to explicitly ask.
- After making significant architectural, technical, workflow, or project-convention decisions, evaluate whether AGENTS.md should be updated. Update it only when the new information would be useful to future AI agents working on the project. Keep instructions concise, durable, and aligned with established best practices for AI coding agents. Do not add temporary implementation details, task-specific notes, or information that can be easily inferred from the codebase.

# Architecture Conventions

- Localized pages live under `app/[locale]`; English and Arabic must remain feature-equivalent and RTL-safe. API routes stay language-neutral under `/api/v1`.
- Keep `/api/v1` outside next-intl locale rewriting; middleware may refresh auth but must not redirect or prefix API paths.
- Keep scheduling and progress calculations as pure functions under `lib/domain`; route handlers should authenticate, validate, delegate, and serialize.
- Supabase requests must use the signed-in user's cookie or bearer session so RLS applies. Never expose or use a service-role/secret key in application clients.
- Every user-owned public table must have explicit authenticated grants, indexed ownership columns, and RLS policies that enforce `auth.uid()` for reads and writes.
- Store daily attribution as ISO local dates and durations as positive whole minutes; use timezone-aware timestamps only for audit events.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
