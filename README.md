# Data Room

A secure, Google-Drive-style **Data Room** for organizing due-diligence documents.
Authenticated users create multiple data rooms, each holding nestable folders and PDF
files with full CRUD. Files are stored in Vercel Blob; metadata lives in Postgres.

Built on an existing [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack)
monorepo (Next.js 16, tRPC v11, Better Auth, Prisma 7 / Neon Postgres, Vercel Blob,
shadcn/ui on Base UI).

**Live demo:** https://dataroom-web-nine.vercel.app/ — sign up to create your first data room.

## Features

- **Auth** — email/password (Better Auth). The entire app is gated; unauthenticated
  visitors are redirected to `/login`.
- **Data rooms** — create, rename, delete. The home page (`/`) lists your rooms.
- **Folders** — create, nest arbitrarily deep, rename, delete (recursively). Breadcrumb
  navigation reflects the folder ancestry.
- **Files** — upload PDFs (multi-select file picker), view inline in a PDF dialog, open in a
  new tab, download, rename, delete.
- **Edge cases** — duplicate names in the same parent auto-suffix `(1)`, `(2)`, …
  (extension-preserving for files); non-PDF and oversized (>50 MB) uploads are rejected
  with a toast; long names truncate; empty/loading states throughout.

## Design decisions

- **Multiple data rooms, no separate list route.** A data room is the top-level "drive".
  The home page *is* the list of rooms (`/`), each opening into `/rooms/[id]`. This
  satisfies the "create Datarooms" requirement while keeping the Google-Drive feel.
- **Metadata in Postgres, bytes in Blob.** `Dataroom`, `Folder`, `File` are Prisma models;
  folders self-reference via `parentId` (null = room root), and files reference an optional
  `folderId`. `File` stores the Blob `url` + `pathname` (the pathname is required to delete
  the object later).
- **Cascade + explicit blob cleanup.** Deleting a room or folder relies on Postgres
  `onDelete: Cascade` to remove descendant rows, but Blob objects are **not** covered by DB
  cascades — so delete mutations first collect every descendant file's `blobPathname` and
  call Blob `del()` before removing the row.
- **Client-side uploads.** The browser uploads directly to Vercel Blob via a signed-token
  route (`/api/blob/upload`), bypassing the 4.5 MB serverless body limit and working on
  localhost. Only metadata flows through tRPC afterward (`file.create`).
- **Authorization at the data layer.** Every tRPC procedure is `protectedProcedure` and
  re-checks that the target row belongs to the caller (`NOT_FOUND`/`FORBIDDEN`). The
  `proxy.ts` cookie redirect is only an optimistic UX gate.
- **Tenant-scoped blob namespace.** Uploads are forced under a `userId/` prefix (enforced in
  the token route *and* re-validated in `file.create`, which also requires `blobUrl` to be a
  Vercel Blob host). This prevents a crafted request from registering — and later deleting —
  another tenant's blob.
- **Auto-suffix over reject.** Duplicate names never block the user; the server picks the
  next free ` (n)`. The rule lives in one pure, unit-tested helper (`resolveUniqueName`).

## Getting started

Prerequisites: Node ≥ 20, pnpm 11, a Neon (or any) Postgres URL, and a Vercel Blob store.

```bash
pnpm install
```

Create `apps/web/.env` (shared by the app and Prisma):

```
DATABASE_URL=postgres://...              # Neon connection string
BETTER_AUTH_SECRET=<32+ char secret>
BETTER_AUTH_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:3000
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_... # from your Vercel Blob store → Tokens
```

Push the schema and start the app:

```bash
pnpm db:push        # sync Prisma schema to the database
pnpm dev:web        # http://localhost:3000
```

Sign up, create a data room, and start organizing folders and PDFs.

## Deployment

Deployed on Vercel: **https://dataroom-web-nine.vercel.app/**. The build task exposes the
app env vars to Turbo, so deploying is just importing the repo and setting the same
variables as above, with the URLs pointing at the production domain:

```
BETTER_AUTH_URL=https://dataroom-web-nine.vercel.app
CORS_ORIGIN=https://dataroom-web-nine.vercel.app
```

`BLOB_READ_WRITE_TOKEN` is provisioned automatically when a Vercel Blob store is linked to
the project.

## Useful commands

```bash
pnpm dev:web                            # run the web app (port 3000)
pnpm dlx ultracite check                # lint/format check (Biome)
pnpm dlx ultracite fix                  # auto-format + auto-fix
pnpm --filter @tailored-tech/api test   # unit tests (resolveUniqueName)
pnpm db:studio                          # inspect the database
```

Type-check the app and API directly (they don't define a `check-types` script):

```bash
pnpm --filter web exec tsc --noEmit
pnpm --filter @tailored-tech/api exec tsc --noEmit
```

## Architecture

```
apps/web                     # Next.js 16 App Router (the only deployable)
  src/app/(home)             # `/` — data-room list, create/rename/delete
  src/app/(auth)/login       # sign-in / sign-up (+ _components/ forms)
  src/app/rooms/[dataroomId] # room root and .../folders/[folderId] (the explorer)
  src/app/rooms/_components   # explorer, toolbar, folder/file items, uploader, PDF viewer
  src/app/api/blob/upload    # Vercel Blob signed-token route (handleUpload)
  src/components/layout      # header, user menu, theme toggle
  src/components/shared      # rename + delete-confirm dialogs (reused across routes)
  src/components/providers   # TanStack Query, theme, toasts
  src/proxy.ts               # auth redirect gate
packages/api                 # tRPC routers (dataroom, folder, file) + ownership/blob helpers
packages/auth                # Better Auth instance
packages/db                  # Prisma schema + generated client (Dataroom/Folder/File + auth)
packages/ui                  # shadcn/Base UI primitives (style: base-vega)
packages/env                 # type-safe env (@t3-oss/env)
```

Request flow: browser → tRPC client (TanStack Query) → `/api/trpc` → `appRouter`
(`packages/api`) → Prisma → Neon. File bytes go browser → Vercel Blob directly.

## Testing

`resolveUniqueName` (the trickiest pure logic) is unit-tested with Vitest. The rest is
verified end-to-end against the running app: auth gate, data-room/folder/file CRUD, nested
navigation + breadcrumbs, duplicate-name suffixing, recursive delete (rows + blobs), and
cross-user isolation.
