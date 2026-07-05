# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm install              # install all workspace deps (runs prisma generate via db postinstall)
pnpm dev                  # run all apps in dev (turbo, persistent)
pnpm dev:web              # run only the web app (Next.js on http://localhost:3000)
pnpm build                # build all packages/apps
pnpm check-types          # tsc --noEmit across the workspace
pnpm check                # ultracite check (Biome lint/format check)
pnpm fix                  # ultracite fix (auto-format + auto-fix lint)
```

Database (all proxied to `@tailored-tech/db` via turbo):

```bash
pnpm db:push              # push Prisma schema to the DB (no migration)
pnpm db:generate          # regenerate the Prisma client into packages/db/prisma/generated
pnpm db:migrate           # create + apply a dev migration
pnpm db:studio            # open Prisma Studio
```

There is no test runner configured in this repo. Code quality is enforced entirely by Ultracite/Biome — run `pnpm fix` before committing.

## Architecture

Turborepo + pnpm-workspace monorepo. A single Next.js app (`apps/web`) is the only deployable; everything else is an internal library under `packages/*`. Dependency versions are centralized in the `catalog:` block of `pnpm-workspace.yaml` — reference a catalog entry rather than pinning a version in a package's `package.json`.

**Internal packages ship raw TypeScript.** Packages export `.ts`/`.tsx` source directly through their `exports` map (e.g. `@tailored-tech/api` exposes `./context` → `./src/context.ts`), with no build step. Consequences:
- To expose a new module from a package, it must be reachable through that package's `exports` map (most use a `./*` wildcard; `env` and `ui` list explicit subpaths).
- Next.js compiles this source directly; there is no `dist/`.

**Data/request flow:** browser → tRPC client (`apps/web/src/utils/trpc.ts`, TanStack Query proxy) → `/api/trpc/[trpc]` route handler → `appRouter` (`packages/api`) → `@tailored-tech/db` (Prisma). Auth session is resolved per-request in the tRPC context and gates procedures.

### Packages

- **`packages/api`** — tRPC v11 server. `src/index.ts` defines `router`, `publicProcedure`, and `protectedProcedure` (throws `UNAUTHORIZED` when `ctx.session` is null). `src/context.ts` builds the per-request context by calling `auth.api.getSession()`. **Add procedures by editing the `appRouter` in `src/routers/index.ts`** — its exported `AppRouter` type is what gives the web client end-to-end type safety.
- **`packages/auth`** — Better-Auth instance (`createAuth()`) using the Prisma adapter over `@tailored-tech/db`, `nextCookies()` plugin, and email/password enabled. Reads secrets from `@tailored-tech/env/server`.
- **`packages/db`** — Prisma 7 with the new `prisma-client` generator. Client is generated into `packages/db/prisma/generated` (checked-in generated code — regenerate with `pnpm db:generate` after schema changes). Uses the `@prisma/adapter-pg` driver adapter over `pg`. Schema is split across `prisma/schema/*.prisma` (`schema.prisma` = generator/datasource, `auth.prisma` = User/Session/Account/Verification models). `createPrismaClient()` is the factory; a default singleton is also exported.
- **`packages/env`** — Type-safe env via `@t3-oss/env`. `./server` (Zod-validated: `DATABASE_URL`, `BETTER_AUTH_SECRET` ≥32 chars, `BETTER_AUTH_URL`, `CORS_ORIGIN`, `NODE_ENV`) and `./web` (client vars). Import from these instead of touching `process.env`. Set `SKIP_ENV_VALIDATION=1` to bypass validation.
- **`packages/ui`** — Shared shadcn/ui component library built on `@base-ui/react` (style `base-lyra`). Components import as `@tailored-tech/ui/components/<name>`; global styles/design tokens live in `src/styles/globals.css`.
- **`packages/config`** — Shared `tsconfig.base.json` extended by every package (strict, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`).

### Web app (`apps/web`)

Next.js 16 App Router, React 19 with the **React Compiler enabled** (`next.config.ts`) and `typedRoutes: true`. Path aliases: `@/*` → `src/*`, `@tailored-tech/ui/*` → the ui package source. Route handlers wire the packages into Next: `api/trpc/[trpc]/route.ts` mounts the tRPC fetch adapter; `api/auth/[...all]/route.ts` mounts Better-Auth via `toNextJsHandler`. Client-side auth is `src/lib/auth-client.ts` (`better-auth/react`). Providers (TanStack Query, theme, Sonner toasts) are in `src/components/providers.tsx`.

## Conventions

- **`.claude/CLAUDE.md`** holds the full Ultracite/Biome code standards this repo enforces (type safety, React/JSX rules, accessibility, etc.) — follow it. Biome auto-fixes most of it via `pnpm fix`.
- **Env files:** app runtime env lives in `apps/web/.env`. `packages/db/prisma.config.ts` also loads `../../apps/web/.env`, so Prisma and the app share one env file.
- **Adding shared UI primitives:** `npx shadcn@latest add <component> -c packages/ui` (run from repo root). App-specific blocks: run the shadcn CLI from `apps/web` instead.
