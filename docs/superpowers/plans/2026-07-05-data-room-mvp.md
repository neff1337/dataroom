# Data Room MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Google-Drive-style Data Room MVP: authenticated users create multiple Data Rooms, each containing nestable folders and PDF files with full CRUD, files stored in Vercel Blob.

**Architecture:** Next.js 16 App Router pages call tRPC v11 procedures (`packages/api`) that talk to Prisma/Neon (`packages/db`). Files upload directly from the browser to Vercel Blob via a signed-token route; only metadata flows through tRPC. Every procedure is `protectedProcedure` and re-checks row ownership. The whole app sits behind a Better-Auth session gate enforced in `middleware.ts`.

**Tech Stack:** Next.js 16 (App Router, React 19, React Compiler, `typedRoutes`), tRPC v11 + TanStack Query, Better Auth 1.6.22, Prisma 7 + `@prisma/adapter-pg` on Neon, `@vercel/blob`, shadcn/ui on `@base-ui/react` (style `base-lyra`), Zod, Ultracite/Biome.

## Global Constraints

- Internal packages ship **raw TypeScript** through their `exports` map — no build step, no `dist/`.
- Dependency versions are centralized in the `catalog:` block of `pnpm-workspace.yaml` — add new deps to the catalog and reference `catalog:`.
- TypeScript is strict with `noUncheckedIndexedAccess` and `verbatimModuleSyntax` (`packages/config/tsconfig.base.json`).
- Every tRPC procedure is `protectedProcedure` and verifies the target row belongs to `ctx.session.user.id`.
- Names are **trimmed, non-empty after trim, max 255 chars**; duplicate names in the same parent get an auto-suffix ` (n)` (extension-preserving for files).
- Uploads: **PDF only** (`application/pdf`), **max 50 MB** (`52428800` bytes) — enforced both in the blob token route and in client pre-validation via a shared constant.
- Code must pass `pnpm check-types` and `pnpm dlx ultracite check`. Run `pnpm dlx ultracite fix` before each commit.
- Web app dev server runs on **http://localhost:3001** (`pnpm dev:web`).
- Prisma generated client is **checked into git** at `packages/db/prisma/generated` — regenerate with `pnpm db:generate` after schema edits and commit the result.

---

### Task 1: Dependencies & environment foundation

**Files:**
- Modify: `pnpm-workspace.yaml` (add `@vercel/blob` to `catalog:`)
- Modify: `packages/api/package.json` (add `@vercel/blob`)
- Modify: `apps/web/package.json` (add `@vercel/blob`)
- Modify: `packages/env/src/server.ts` (add `BLOB_READ_WRITE_TOKEN`)
- Modify: `apps/web/.env` (add `BLOB_READ_WRITE_TOKEN`)

**Interfaces:**
- Produces: `env.BLOB_READ_WRITE_TOKEN: string` from `@tailored-tech/env/server`.

- [ ] **Step 1: Add `@vercel/blob` to the catalog**

In `pnpm-workspace.yaml`, under `catalog:`, add:

```yaml
  "@vercel/blob": ^2.0.0
```

- [ ] **Step 2: Reference it from both packages**

In `packages/api/package.json` `dependencies` and `apps/web/package.json` `dependencies`, add:

```json
    "@vercel/blob": "catalog:",
```

- [ ] **Step 3: Install**

Run: `pnpm install`
Expected: resolves and links `@vercel/blob` into both packages.

- [ ] **Step 4: Add the env var to the schema**

In `packages/env/src/server.ts`, add inside the `server:` object (after `CORS_ORIGIN`):

```ts
    BLOB_READ_WRITE_TOKEN: z.string().min(1),
```

- [ ] **Step 5: Add the token to `.env`**

In `apps/web/.env`, add (value comes from the user's Vercel Blob store settings):

```
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxxxxxx
```

- [ ] **Step 6: Verify types**

Run: `pnpm check-types`
Expected: PASS (no missing-module or env errors).

- [ ] **Step 7: Commit**

```bash
git add pnpm-workspace.yaml packages/api/package.json apps/web/package.json packages/env/src/server.ts pnpm-lock.yaml
git commit -m "chore: add @vercel/blob dependency and BLOB_READ_WRITE_TOKEN env"
```

---

### Task 2: Prisma data model (Dataroom / Folder / File)

**Files:**
- Create: `packages/db/prisma/schema/dataroom.prisma`
- Modify: `packages/db/prisma/schema/auth.prisma` (add `datarooms` relation to `User`)

**Interfaces:**
- Produces: Prisma models `Dataroom`, `Folder`, `File` and their generated client types (`import type { Dataroom, Folder, File } from "@tailored-tech/db/prisma/generated/client"` when needed; routers use `ctx.db.dataroom` etc.).

- [ ] **Step 1: Create the schema file**

Create `packages/db/prisma/schema/dataroom.prisma`:

```prisma
model Dataroom {
  id        String   @id @default(cuid())
  name      String
  ownerId   String
  owner     User     @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  folders   Folder[]
  files     File[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([ownerId])
  @@map("dataroom")
}

model Folder {
  id         String   @id @default(cuid())
  name       String
  dataroomId String
  dataroom   Dataroom @relation(fields: [dataroomId], references: [id], onDelete: Cascade)
  parentId   String?
  parent     Folder?  @relation("FolderTree", fields: [parentId], references: [id], onDelete: Cascade)
  children   Folder[] @relation("FolderTree")
  files      File[]
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([dataroomId])
  @@index([parentId])
  @@map("folder")
}

model File {
  id           String   @id @default(cuid())
  name         String
  dataroomId   String
  dataroom     Dataroom @relation(fields: [dataroomId], references: [id], onDelete: Cascade)
  folderId     String?
  folder       Folder?  @relation(fields: [folderId], references: [id], onDelete: Cascade)
  blobUrl      String
  blobPathname String
  size         Int
  contentType  String   @default("application/pdf")
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([dataroomId])
  @@index([folderId])
  @@map("file")
}
```

- [ ] **Step 2: Add the reverse relation on `User`**

In `packages/db/prisma/schema/auth.prisma`, inside `model User`, after the `accounts Account[]` line, add:

```prisma
  datarooms     Dataroom[]
```

- [ ] **Step 3: Push schema to Neon and regenerate the client**

Run: `pnpm db:push && pnpm db:generate`
Expected: Neon gets `dataroom`/`folder`/`file` tables; generated client under `packages/db/prisma/generated` updates.

- [ ] **Step 4: Verify types**

Run: `pnpm check-types`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/db/prisma/schema/dataroom.prisma packages/db/prisma/schema/auth.prisma packages/db/prisma/generated
git commit -m "feat(db): add Dataroom, Folder, File models"
```

---

### Task 3: API foundation — db in context, unique-name helper (TDD), ownership & blob helpers

**Files:**
- Modify: `packages/api/src/context.ts` (add `db` to context)
- Create: `packages/api/src/lib/resolve-unique-name.ts`
- Create: `packages/api/src/lib/resolve-unique-name.test.ts`
- Create: `packages/api/src/lib/ownership.ts`
- Create: `packages/api/src/lib/blob.ts`
- Modify: `packages/api/package.json` (add `vitest` devDep + `test` script)
- Modify: `packages/api/src/index.ts` — no change needed, but confirm `protectedProcedure` exists.

**Interfaces:**
- Produces:
  - `ctx.db` — the Prisma client singleton, available in every procedure.
  - `resolveUniqueName(existing: string[], desired: string, isFile: boolean): string`
  - `assertDataroomOwner(db, userId, dataroomId): Promise<Dataroom>`
  - `assertFolderOwner(db, userId, folderId): Promise<Folder>`
  - `assertFileOwner(db, userId, fileId): Promise<File>`
  - `collectFolderBlobPathnames(db, folderId): Promise<string[]>`
  - `collectDataroomBlobPathnames(db, dataroomId): Promise<string[]>`

- [ ] **Step 1: Add vitest to the api package**

In `packages/api/package.json`, add to `devDependencies`:

```json
    "vitest": "^3.2.4",
```

and to `scripts`:

```json
    "test": "vitest run"
```

Run: `pnpm install`

- [ ] **Step 2: Write the failing test for `resolveUniqueName`**

Create `packages/api/src/lib/resolve-unique-name.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { resolveUniqueName } from "./resolve-unique-name";

describe("resolveUniqueName", () => {
  it("returns the desired name when there is no collision", () => {
    expect(resolveUniqueName([], "Reports", false)).toBe("Reports");
  });

  it("suffixes a colliding folder name", () => {
    expect(resolveUniqueName(["Reports"], "Reports", false)).toBe("Reports (1)");
  });

  it("increments to the next free suffix", () => {
    expect(resolveUniqueName(["Reports", "Reports (1)"], "Reports", false)).toBe(
      "Reports (2)"
    );
  });

  it("preserves the extension for files", () => {
    expect(resolveUniqueName(["report.pdf"], "report.pdf", true)).toBe(
      "report (1).pdf"
    );
  });

  it("suffixes files with no extension like a folder", () => {
    expect(resolveUniqueName(["notes"], "notes", true)).toBe("notes (1)");
  });

  it("is case-insensitive when detecting collisions", () => {
    expect(resolveUniqueName(["REPORT.pdf"], "report.pdf", true)).toBe(
      "report (1).pdf"
    );
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm --filter @tailored-tech/api test`
Expected: FAIL — cannot find module `./resolve-unique-name`.

- [ ] **Step 4: Implement `resolveUniqueName`**

Create `packages/api/src/lib/resolve-unique-name.ts`:

```ts
const SUFFIX_PATTERN = / \((\d+)\)$/;

function splitExtension(name: string, isFile: boolean): [string, string] {
  if (!isFile) {
    return [name, ""];
  }
  const dot = name.lastIndexOf(".");
  if (dot <= 0) {
    return [name, ""];
  }
  return [name.slice(0, dot), name.slice(dot)];
}

/**
 * Returns `desired` if it does not collide (case-insensitively) with any name
 * in `existing`, otherwise appends the smallest free ` (n)` suffix. For files
 * the suffix is inserted before the extension: `report.pdf` -> `report (1).pdf`.
 */
export function resolveUniqueName(
  existing: string[],
  desired: string,
  isFile: boolean
): string {
  const taken = new Set(existing.map((name) => name.toLowerCase()));
  if (!taken.has(desired.toLowerCase())) {
    return desired;
  }
  const [base, ext] = splitExtension(desired, isFile);
  const baseWithoutSuffix = base.replace(SUFFIX_PATTERN, "");
  let counter = 1;
  let candidate = `${baseWithoutSuffix} (${counter})${ext}`;
  while (taken.has(candidate.toLowerCase())) {
    counter += 1;
    candidate = `${baseWithoutSuffix} (${counter})${ext}`;
  }
  return candidate;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter @tailored-tech/api test`
Expected: PASS (6 passing).

- [ ] **Step 6: Add `db` to the tRPC context**

Replace `packages/api/src/context.ts` with:

```ts
import { auth } from "@tailored-tech/auth";
import db from "@tailored-tech/db";
import type { NextRequest } from "next/server";

export async function createContext(req: NextRequest) {
  const session = await auth.api.getSession({
    headers: req.headers,
  });
  return {
    db,
    session,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
```

- [ ] **Step 7: Write the ownership helpers**

Create `packages/api/src/lib/ownership.ts`:

```ts
import { TRPCError } from "@trpc/server";

import type { Context } from "../context";

type Db = Context["db"];

export async function assertDataroomOwner(
  db: Db,
  userId: string,
  dataroomId: string
) {
  const dataroom = await db.dataroom.findUnique({ where: { id: dataroomId } });
  if (!dataroom) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Data room not found" });
  }
  if (dataroom.ownerId !== userId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Not your data room" });
  }
  return dataroom;
}

export async function assertFolderOwner(
  db: Db,
  userId: string,
  folderId: string
) {
  const folder = await db.folder.findUnique({
    where: { id: folderId },
    include: { dataroom: true },
  });
  if (!folder) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Folder not found" });
  }
  if (folder.dataroom.ownerId !== userId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Not your folder" });
  }
  return folder;
}

export async function assertFileOwner(db: Db, userId: string, fileId: string) {
  const file = await db.file.findUnique({
    where: { id: fileId },
    include: { dataroom: true },
  });
  if (!file) {
    throw new TRPCError({ code: "NOT_FOUND", message: "File not found" });
  }
  if (file.dataroom.ownerId !== userId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Not your file" });
  }
  return file;
}
```

- [ ] **Step 8: Write the blob-pathname collectors**

Create `packages/api/src/lib/blob.ts`:

```ts
import type { Context } from "../context";

type Db = Context["db"];

/** Recursively collect blobPathname of every file under `folderId` (inclusive). */
export async function collectFolderBlobPathnames(
  db: Db,
  folderId: string
): Promise<string[]> {
  const [files, childFolders] = await Promise.all([
    db.file.findMany({ where: { folderId }, select: { blobPathname: true } }),
    db.folder.findMany({ where: { parentId: folderId }, select: { id: true } }),
  ]);
  const pathnames = files.map((file) => file.blobPathname);
  for (const child of childFolders) {
    pathnames.push(...(await collectFolderBlobPathnames(db, child.id)));
  }
  return pathnames;
}

/** Collect blobPathname of every file in the whole data room. */
export async function collectDataroomBlobPathnames(
  db: Db,
  dataroomId: string
): Promise<string[]> {
  const files = await db.file.findMany({
    where: { dataroomId },
    select: { blobPathname: true },
  });
  return files.map((file) => file.blobPathname);
}
```

- [ ] **Step 9: Verify types & lint**

Run: `pnpm check-types && pnpm dlx ultracite check`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add packages/api
git commit -m "feat(api): add db context, resolveUniqueName (tested), ownership & blob helpers"
```

---

### Task 4: Dataroom router

**Files:**
- Create: `packages/api/src/routers/dataroom.ts`
- Modify: `packages/api/src/routers/index.ts` (register `dataroom`, remove `privateData`)

**Interfaces:**
- Consumes: `protectedProcedure` (`../index`), `assertDataroomOwner` (`../lib/ownership`), `resolveUniqueName` (`../lib/resolve-unique-name`), `collectDataroomBlobPathnames` (`../lib/blob`), `del` (`@vercel/blob`).
- Produces: `dataroomRouter` with `list`, `create`, `rename`, `remove`; each returns the Prisma row (or `{ id }` for remove).

- [ ] **Step 1: Write the dataroom router**

Create `packages/api/src/routers/dataroom.ts`:

```ts
import { del } from "@vercel/blob";
import { z } from "zod";

import { protectedProcedure, router } from "../index";
import { collectDataroomBlobPathnames } from "../lib/blob";
import { assertDataroomOwner } from "../lib/ownership";
import { resolveUniqueName } from "../lib/resolve-unique-name";

const name = z.string().trim().min(1).max(255);

export const dataroomRouter = router({
  list: protectedProcedure.query(({ ctx }) =>
    ctx.db.dataroom.findMany({
      where: { ownerId: ctx.session.user.id },
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { folders: true, files: true } } },
    })
  ),

  create: protectedProcedure
    .input(z.object({ name }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.dataroom.findMany({
        where: { ownerId: ctx.session.user.id },
        select: { name: true },
      });
      return ctx.db.dataroom.create({
        data: {
          name: resolveUniqueName(
            existing.map((room) => room.name),
            input.name,
            false
          ),
          ownerId: ctx.session.user.id,
        },
      });
    }),

  rename: protectedProcedure
    .input(z.object({ id: z.string(), name }))
    .mutation(async ({ ctx, input }) => {
      await assertDataroomOwner(ctx.db, ctx.session.user.id, input.id);
      const siblings = await ctx.db.dataroom.findMany({
        where: { ownerId: ctx.session.user.id, id: { not: input.id } },
        select: { name: true },
      });
      return ctx.db.dataroom.update({
        where: { id: input.id },
        data: {
          name: resolveUniqueName(
            siblings.map((room) => room.name),
            input.name,
            false
          ),
        },
      });
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertDataroomOwner(ctx.db, ctx.session.user.id, input.id);
      const pathnames = await collectDataroomBlobPathnames(ctx.db, input.id);
      if (pathnames.length > 0) {
        await del(pathnames);
      }
      await ctx.db.dataroom.delete({ where: { id: input.id } });
      return { id: input.id };
    }),
});
```

- [ ] **Step 2: Register it and remove the demo procedure**

Replace `packages/api/src/routers/index.ts` with:

```ts
import { publicProcedure, router } from "../index";
import { dataroomRouter } from "./dataroom";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => "OK"),
  dataroom: dataroomRouter,
});
export type AppRouter = typeof appRouter;
```

- [ ] **Step 3: Verify types & lint**

Run: `pnpm check-types && pnpm dlx ultracite check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/routers
git commit -m "feat(api): add dataroom router (list/create/rename/remove)"
```

---

### Task 5: Folder router

**Files:**
- Create: `packages/api/src/routers/folder.ts`
- Modify: `packages/api/src/routers/index.ts` (register `folder`)

**Interfaces:**
- Consumes: `assertDataroomOwner`, `assertFolderOwner`, `resolveUniqueName`, `collectFolderBlobPathnames`, `del`.
- Produces: `folderRouter` with `contents({dataroomId, folderId})`, `breadcrumb({folderId})`, `create`, `rename`, `remove`.
  - `contents` returns `{ folders: Folder[]; files: File[] }`.
  - `breadcrumb` returns `Array<{ id: string; name: string }>` ordered root→current.

- [ ] **Step 1: Write the folder router**

Create `packages/api/src/routers/folder.ts`:

```ts
import { del } from "@vercel/blob";
import { z } from "zod";

import { protectedProcedure, router } from "../index";
import { collectFolderBlobPathnames } from "../lib/blob";
import {
  assertDataroomOwner,
  assertFolderOwner,
} from "../lib/ownership";
import { resolveUniqueName } from "../lib/resolve-unique-name";

const name = z.string().trim().min(1).max(255);

export const folderRouter = router({
  contents: protectedProcedure
    .input(
      z.object({
        dataroomId: z.string(),
        folderId: z.string().nullable(),
      })
    )
    .query(async ({ ctx, input }) => {
      await assertDataroomOwner(ctx.db, ctx.session.user.id, input.dataroomId);
      const [folders, files] = await Promise.all([
        ctx.db.folder.findMany({
          where: { dataroomId: input.dataroomId, parentId: input.folderId },
          orderBy: { name: "asc" },
        }),
        ctx.db.file.findMany({
          where: { dataroomId: input.dataroomId, folderId: input.folderId },
          orderBy: { name: "asc" },
        }),
      ]);
      return { folders, files };
    }),

  breadcrumb: protectedProcedure
    .input(z.object({ folderId: z.string() }))
    .query(async ({ ctx, input }) => {
      const chain: Array<{ id: string; name: string }> = [];
      let currentId: string | null = input.folderId;
      while (currentId) {
        const folder = await assertFolderOwner(
          ctx.db,
          ctx.session.user.id,
          currentId
        );
        chain.unshift({ id: folder.id, name: folder.name });
        currentId = folder.parentId;
      }
      return chain;
    }),

  create: protectedProcedure
    .input(
      z.object({
        dataroomId: z.string(),
        parentId: z.string().nullable(),
        name,
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertDataroomOwner(ctx.db, ctx.session.user.id, input.dataroomId);
      if (input.parentId) {
        await assertFolderOwner(ctx.db, ctx.session.user.id, input.parentId);
      }
      const siblings = await ctx.db.folder.findMany({
        where: { dataroomId: input.dataroomId, parentId: input.parentId },
        select: { name: true },
      });
      return ctx.db.folder.create({
        data: {
          name: resolveUniqueName(
            siblings.map((folder) => folder.name),
            input.name,
            false
          ),
          dataroomId: input.dataroomId,
          parentId: input.parentId,
        },
      });
    }),

  rename: protectedProcedure
    .input(z.object({ id: z.string(), name }))
    .mutation(async ({ ctx, input }) => {
      const folder = await assertFolderOwner(
        ctx.db,
        ctx.session.user.id,
        input.id
      );
      const siblings = await ctx.db.folder.findMany({
        where: {
          dataroomId: folder.dataroomId,
          parentId: folder.parentId,
          id: { not: folder.id },
        },
        select: { name: true },
      });
      return ctx.db.folder.update({
        where: { id: folder.id },
        data: {
          name: resolveUniqueName(
            siblings.map((sibling) => sibling.name),
            input.name,
            false
          ),
        },
      });
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertFolderOwner(ctx.db, ctx.session.user.id, input.id);
      const pathnames = await collectFolderBlobPathnames(ctx.db, input.id);
      if (pathnames.length > 0) {
        await del(pathnames);
      }
      await ctx.db.folder.delete({ where: { id: input.id } });
      return { id: input.id };
    }),
});
```

- [ ] **Step 2: Register it**

In `packages/api/src/routers/index.ts`, add the import and entry:

```ts
import { folderRouter } from "./folder";
```
and inside `router({ ... })` add:
```ts
  folder: folderRouter,
```

- [ ] **Step 3: Verify types & lint**

Run: `pnpm check-types && pnpm dlx ultracite check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/api/src/routers
git commit -m "feat(api): add folder router (contents/breadcrumb/create/rename/remove)"
```

---

### Task 6: File router + Blob upload route

**Files:**
- Create: `packages/api/src/routers/file.ts`
- Modify: `packages/api/src/routers/index.ts` (register `file`)
- Create: `apps/web/src/lib/upload-constants.ts` (shared limits)
- Create: `apps/web/src/app/api/blob/upload/route.ts`

**Interfaces:**
- Consumes: `assertDataroomOwner`, `assertFolderOwner`, `assertFileOwner`, `resolveUniqueName`, `del`; `handleUpload` (`@vercel/blob/client`); `auth` (`@tailored-tech/auth`).
- Produces:
  - `fileRouter` with `create`, `rename`, `remove`.
  - `MAX_UPLOAD_BYTES = 52_428_800`, `ACCEPTED_MIME = "application/pdf"`.
  - `POST /api/blob/upload` returning the `handleUpload` JSON response.

- [ ] **Step 1: Write shared upload constants**

Create `apps/web/src/lib/upload-constants.ts`:

```ts
export const MAX_UPLOAD_BYTES = 52_428_800; // 50 MB
export const ACCEPTED_MIME = "application/pdf";
```

- [ ] **Step 2: Write the file router**

Create `packages/api/src/routers/file.ts`:

```ts
import { del } from "@vercel/blob";
import { z } from "zod";

import { protectedProcedure, router } from "../index";
import {
  assertDataroomOwner,
  assertFileOwner,
  assertFolderOwner,
} from "../lib/ownership";
import { resolveUniqueName } from "../lib/resolve-unique-name";

const name = z.string().trim().min(1).max(255);

export const fileRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        dataroomId: z.string(),
        folderId: z.string().nullable(),
        name,
        blobUrl: z.string().url(),
        blobPathname: z.string().min(1),
        size: z.number().int().nonnegative(),
        contentType: z.string().default("application/pdf"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertDataroomOwner(ctx.db, ctx.session.user.id, input.dataroomId);
      if (input.folderId) {
        await assertFolderOwner(ctx.db, ctx.session.user.id, input.folderId);
      }
      const siblings = await ctx.db.file.findMany({
        where: { dataroomId: input.dataroomId, folderId: input.folderId },
        select: { name: true },
      });
      return ctx.db.file.create({
        data: {
          name: resolveUniqueName(
            siblings.map((file) => file.name),
            input.name,
            true
          ),
          dataroomId: input.dataroomId,
          folderId: input.folderId,
          blobUrl: input.blobUrl,
          blobPathname: input.blobPathname,
          size: input.size,
          contentType: input.contentType,
        },
      });
    }),

  rename: protectedProcedure
    .input(z.object({ id: z.string(), name }))
    .mutation(async ({ ctx, input }) => {
      const file = await assertFileOwner(ctx.db, ctx.session.user.id, input.id);
      const siblings = await ctx.db.file.findMany({
        where: {
          dataroomId: file.dataroomId,
          folderId: file.folderId,
          id: { not: file.id },
        },
        select: { name: true },
      });
      return ctx.db.file.update({
        where: { id: file.id },
        data: {
          name: resolveUniqueName(
            siblings.map((sibling) => sibling.name),
            input.name,
            true
          ),
        },
      });
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const file = await assertFileOwner(ctx.db, ctx.session.user.id, input.id);
      await del(file.blobPathname);
      await ctx.db.file.delete({ where: { id: file.id } });
      return { id: file.id };
    }),
});
```

- [ ] **Step 3: Register it**

In `packages/api/src/routers/index.ts`, add:

```ts
import { fileRouter } from "./file";
```
and inside `router({ ... })`:
```ts
  file: fileRouter,
```

- [ ] **Step 4: Write the blob upload route**

Create `apps/web/src/app/api/blob/upload/route.ts`:

```ts
import { auth } from "@tailored-tech/auth";
import {
  handleUpload,
  type HandleUploadBody,
} from "@vercel/blob/client";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

import { ACCEPTED_MIME, MAX_UPLOAD_BYTES } from "@/lib/upload-constants";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const session = await auth.api.getSession({
          headers: await headers(),
        });
        if (!session?.user) {
          throw new Error("Unauthorized");
        }
        return {
          allowedContentTypes: [ACCEPTED_MIME],
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: () => {
        // No-op: the DB row is created by the client via trpc.file.create,
        // so this works on localhost where Blob cannot call back.
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    );
  }
}
```

- [ ] **Step 5: Verify types & lint**

Run: `pnpm check-types && pnpm dlx ultracite check`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/routers apps/web/src/lib/upload-constants.ts apps/web/src/app/api/blob
git commit -m "feat: add file router and Vercel Blob upload route"
```

---

### Task 7: Auth gate, route shells, header cleanup

**Files:**
- Create: `apps/web/src/middleware.ts`
- Delete: `apps/web/src/app/dashboard/page.tsx`, `apps/web/src/app/dashboard/dashboard.tsx`
- Replace: `apps/web/src/app/page.tsx` (Data Rooms home shell)
- Create: `apps/web/src/app/rooms/[dataroomId]/page.tsx`
- Create: `apps/web/src/app/rooms/[dataroomId]/folders/[folderId]/page.tsx`
- Modify: `apps/web/src/components/header.tsx` (remove Dashboard link; keep brand + user menu)

**Interfaces:**
- Consumes: `getSessionCookie` (`better-auth/cookies`), `auth` (`@tailored-tech/auth`).
- Produces: gated routing; `/` renders `<DataroomHome/>` (built in Task 9); `/rooms/...` render `<Explorer/>` (built in Task 10). For this task the pages render simple placeholders that compile.

- [ ] **Step 1: Add the middleware**

Create `apps/web/src/middleware.ts`:

```ts
import { getSessionCookie } from "better-auth/cookies";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|login|_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 2: Remove the demo dashboard**

Run:
```bash
git rm apps/web/src/app/dashboard/page.tsx apps/web/src/app/dashboard/dashboard.tsx
```

- [ ] **Step 3: Replace the home page with a server shell**

Replace `apps/web/src/app/page.tsx` with:

```tsx
import { auth } from "@tailored-tech/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect("/login");
  }
  return (
    <main className="container mx-auto max-w-5xl px-4 py-6">
      <h1 className="font-semibold text-2xl">Data Rooms</h1>
    </main>
  );
}
```

- [ ] **Step 4: Add the room root page shell**

Create `apps/web/src/app/rooms/[dataroomId]/page.tsx`:

```tsx
export default async function RoomPage({
  params,
}: {
  params: Promise<{ dataroomId: string }>;
}) {
  const { dataroomId } = await params;
  return (
    <main className="container mx-auto max-w-5xl px-4 py-6">
      <p className="text-muted-foreground text-sm">Room {dataroomId}</p>
    </main>
  );
}
```

- [ ] **Step 5: Add the nested folder page shell**

Create `apps/web/src/app/rooms/[dataroomId]/folders/[folderId]/page.tsx`:

```tsx
export default async function FolderPage({
  params,
}: {
  params: Promise<{ dataroomId: string; folderId: string }>;
}) {
  const { dataroomId, folderId } = await params;
  return (
    <main className="container mx-auto max-w-5xl px-4 py-6">
      <p className="text-muted-foreground text-sm">
        Room {dataroomId} / Folder {folderId}
      </p>
    </main>
  );
}
```

- [ ] **Step 6: Simplify the header**

Replace the `links` array in `apps/web/src/components/header.tsx` so only the brand shows (remove `/dashboard` and the ASCII-era `/` label), keeping `ModeToggle` and `UserMenu`:

```tsx
"use client";
import Link from "next/link";

import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";

export default function Header() {
  return (
    <div>
      <div className="flex flex-row items-center justify-between px-3 py-2">
        <Link className="font-semibold" href="/">
          Data Room
        </Link>
        <div className="flex items-center gap-2">
          <ModeToggle />
          <UserMenu />
        </div>
      </div>
      <hr />
    </div>
  );
}
```

- [ ] **Step 7: Verify the gate end-to-end**

Run: `pnpm dev:web`, open http://localhost:3001 in a logged-out browser.
Expected: redirect to `/login`. After signing in, `/` shows the "Data Rooms" heading. Stop the server.

- [ ] **Step 8: Verify types & lint, then commit**

```bash
pnpm check-types && pnpm dlx ultracite check
git add apps/web/src
git commit -m "feat(web): gate app behind auth, add room route shells, clean header"
```

---

### Task 8: Add shadcn UI primitives

**Files:**
- Create (via CLI): `packages/ui/src/components/dialog.tsx`, `alert-dialog.tsx`, `breadcrumb.tsx`, `context-menu.tsx`, `progress.tsx`

**Interfaces:**
- Produces: `Dialog*`, `AlertDialog*`, `Breadcrumb*`, `ContextMenu*`, `Progress` exports from `@tailored-tech/ui/components/<name>`, matching the existing `base-lyra` style.

- [ ] **Step 1: Add the components from the base-lyra registry**

Run from repo root:
```bash
npx shadcn@latest add dialog alert-dialog breadcrumb context-menu progress -c packages/ui
```
Expected: five new files under `packages/ui/src/components/`. If the CLI cannot resolve the `base-lyra` registry, hand-author thin wrappers over `@base-ui/react`'s `dialog`, `alert-dialog`, `menu`, `progress` following the pattern in `packages/ui/src/components/dropdown-menu.tsx`.

- [ ] **Step 2: Verify types & lint**

Run: `pnpm check-types && pnpm dlx ultracite check`
Expected: PASS (run `pnpm dlx ultracite fix` first to normalize generated files).

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/components
git commit -m "feat(ui): add dialog, alert-dialog, breadcrumb, context-menu, progress"
```

---

### Task 9: Data Rooms home UI

**Files:**
- Create: `apps/web/src/components/dataroom/create-dataroom-dialog.tsx`
- Create: `apps/web/src/components/dataroom/dataroom-card.tsx`
- Create: `apps/web/src/components/dataroom/dataroom-home.tsx`
- Modify: `apps/web/src/app/page.tsx` (render `<DataroomHome/>`)

**Interfaces:**
- Consumes: `trpc.dataroom.list/create/rename/remove` (`@/utils/trpc`), `Dialog*`, `Card`, `Button`, `Input`, `Empty`, `Skeleton`, `DropdownMenu*`, `AlertDialog*`, `sonner` toast.
- Produces: `<DataroomHome/>` client component rendering the grid + create dialog.

- [ ] **Step 1: Create the create-dataroom dialog**

Create `apps/web/src/components/dataroom/create-dataroom-dialog.tsx`:

```tsx
"use client";

import { Button } from "@tailored-tech/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@tailored-tech/ui/components/dialog";
import { Input } from "@tailored-tech/ui/components/input";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { trpc } from "@/utils/trpc";

export function CreateDataroomDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const queryClient = useQueryClient();

  const createMutation = useMutation(
    trpc.dataroom.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.dataroom.list.queryKey(),
        });
        toast.success("Data room created");
        setOpen(false);
        setName("");
      },
      onError: (error) => toast.error(error.message),
    })
  );

  const trimmed = name.trim();

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger render={<Button />}>
        <Plus />
        New Data Room
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Data Room</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (trimmed) {
              createMutation.mutate({ name: trimmed });
            }
          }}
        >
          <Input
            autoFocus
            maxLength={255}
            onChange={(event) => setName(event.target.value)}
            placeholder="Acme acquisition"
            value={name}
          />
          <DialogFooter className="mt-4">
            <Button
              disabled={!trimmed || createMutation.isPending}
              type="submit"
            >
              {createMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Create the dataroom card**

Create `apps/web/src/components/dataroom/dataroom-card.tsx`:

```tsx
"use client";

import { Card } from "@tailored-tech/ui/components/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@tailored-tech/ui/components/dropdown-menu";
import { FolderOpen, MoreVertical } from "lucide-react";
import Link from "next/link";

type DataroomCardProps = {
  id: string;
  name: string;
  folderCount: number;
  fileCount: number;
  onRename: () => void;
  onDelete: () => void;
};

export function DataroomCard({
  id,
  name,
  folderCount,
  fileCount,
  onRename,
  onDelete,
}: DataroomCardProps) {
  return (
    <Card className="flex items-start justify-between gap-2 p-4">
      <Link className="flex min-w-0 flex-1 items-start gap-3" href={`/rooms/${id}`}>
        <FolderOpen className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
        <span className="min-w-0">
          <span className="block truncate font-medium">{name}</span>
          <span className="text-muted-foreground text-xs">
            {folderCount} folders · {fileCount} files
          </span>
        </span>
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger className="text-muted-foreground hover:text-foreground">
          <MoreVertical className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-card">
          <DropdownMenuItem onClick={onRename}>Rename</DropdownMenuItem>
          <DropdownMenuItem onClick={onDelete} variant="destructive">
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </Card>
  );
}
```

- [ ] **Step 3: Create the home component**

Create `apps/web/src/components/dataroom/dataroom-home.tsx`:

```tsx
"use client";

import { Empty } from "@tailored-tech/ui/components/empty";
import { Skeleton } from "@tailored-tech/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { trpc } from "@/utils/trpc";

import { CreateDataroomDialog } from "./create-dataroom-dialog";
import { DataroomCard } from "./dataroom-card";
import { DeleteConfirmDialog } from "./delete-confirm-dialog";
import { RenameDialog } from "./rename-dialog";

export function DataroomHome() {
  const roomsQuery = useQuery(trpc.dataroom.list.queryOptions());
  const [renameTarget, setRenameTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  return (
    <main className="container mx-auto max-w-5xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-semibold text-2xl">Data Rooms</h1>
        <CreateDataroomDialog />
      </div>

      {roomsQuery.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : null}

      {roomsQuery.data && roomsQuery.data.length === 0 ? (
        <Empty>
          <p className="text-muted-foreground text-sm">
            No data rooms yet. Create your first one to start uploading
            documents.
          </p>
        </Empty>
      ) : null}

      {roomsQuery.data && roomsQuery.data.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {roomsQuery.data.map((room) => (
            <DataroomCard
              fileCount={room._count.files}
              folderCount={room._count.folders}
              id={room.id}
              key={room.id}
              name={room.name}
              onDelete={() =>
                setDeleteTarget({ id: room.id, name: room.name })
              }
              onRename={() =>
                setRenameTarget({ id: room.id, name: room.name })
              }
            />
          ))}
        </div>
      ) : null}

      <RenameDialog
        kind="dataroom"
        onOpenChange={(next) => !next && setRenameTarget(null)}
        target={renameTarget}
      />
      <DeleteConfirmDialog
        kind="dataroom"
        onOpenChange={(next) => !next && setDeleteTarget(null)}
        target={deleteTarget}
      />
    </main>
  );
}
```

> `RenameDialog` and `DeleteConfirmDialog` are built in Task 11. To keep this task compiling on its own, first create the two files with the stubs shown in Task 11 Step 1 (they are shared across home + explorer), then return here.

- [ ] **Step 4: Render it from the home page**

Replace `apps/web/src/app/page.tsx` body to render the client component (keep the server-side session guard):

```tsx
import { auth } from "@tailored-tech/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { DataroomHome } from "@/components/dataroom/dataroom-home";

export default async function HomePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect("/login");
  }
  return <DataroomHome />;
}
```

- [ ] **Step 5: Verify in browser**

Run: `pnpm dev:web`. On `/`, create a data room → it appears; the empty state shows when none exist. Stop the server.

- [ ] **Step 6: Verify types & lint, then commit**

```bash
pnpm check-types && pnpm dlx ultracite check
git add apps/web/src
git commit -m "feat(web): data rooms home (grid, create, empty/loading states)"
```

---

### Task 9-shared: Rename & Delete dialogs (shared primitives)

> Build these BEFORE finishing Task 9 Step 3 (the home imports them). They are reused by the explorer.

**Files:**
- Create: `apps/web/src/components/dataroom/rename-dialog.tsx`
- Create: `apps/web/src/components/dataroom/delete-confirm-dialog.tsx`

**Interfaces:**
- Consumes: `trpc.dataroom.rename`, `trpc.folder.rename`, `trpc.file.rename`, and the matching `remove` procedures.
- Produces:
  - `<RenameDialog kind="dataroom"|"folder"|"file" target={{id,name}|null} onOpenChange onRenamed? />`
  - `<DeleteConfirmDialog kind="dataroom"|"folder"|"file" target={{id,name}|null} onOpenChange onDeleted? />`

- [ ] **Step 1: Rename dialog**

Create `apps/web/src/components/dataroom/rename-dialog.tsx`:

```tsx
"use client";

import { Button } from "@tailored-tech/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@tailored-tech/ui/components/dialog";
import { Input } from "@tailored-tech/ui/components/input";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { trpc } from "@/utils/trpc";

type Kind = "dataroom" | "folder" | "file";

type RenameDialogProps = {
  kind: Kind;
  target: { id: string; name: string } | null;
  onOpenChange: (open: boolean) => void;
  onRenamed?: () => void;
};

function useRenameMutation(kind: Kind) {
  const dataroom = useMutation(trpc.dataroom.rename.mutationOptions());
  const folder = useMutation(trpc.folder.rename.mutationOptions());
  const file = useMutation(trpc.file.rename.mutationOptions());
  if (kind === "dataroom") {
    return dataroom;
  }
  if (kind === "folder") {
    return folder;
  }
  return file;
}

export function RenameDialog({
  kind,
  target,
  onOpenChange,
  onRenamed,
}: RenameDialogProps) {
  const [name, setName] = useState("");
  const queryClient = useQueryClient();
  const mutation = useRenameMutation(kind);

  useEffect(() => {
    setName(target?.name ?? "");
  }, [target]);

  if (!target) {
    return null;
  }

  const trimmed = name.trim();

  const submit = () => {
    mutation.mutate(
      { id: target.id, name: trimmed },
      {
        onSuccess: () => {
          queryClient.invalidateQueries();
          toast.success("Renamed");
          onRenamed?.();
          onOpenChange(false);
        },
        onError: (error) => toast.error(error.message),
      }
    );
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={Boolean(target)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename {kind}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (trimmed) {
              submit();
            }
          }}
        >
          <Input
            autoFocus
            maxLength={255}
            onChange={(event) => setName(event.target.value)}
            value={name}
          />
          <DialogFooter className="mt-4">
            <Button
              disabled={!trimmed || mutation.isPending}
              type="submit"
            >
              {mutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Delete confirm dialog**

Create `apps/web/src/components/dataroom/delete-confirm-dialog.tsx`:

```tsx
"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@tailored-tech/ui/components/alert-dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { trpc } from "@/utils/trpc";

type Kind = "dataroom" | "folder" | "file";

type DeleteConfirmDialogProps = {
  kind: Kind;
  target: { id: string; name: string } | null;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
};

const RECURSIVE_WARNING: Record<Kind, string> = {
  dataroom: "This deletes the data room and all its folders and files.",
  folder: "This deletes the folder and everything inside it.",
  file: "This permanently deletes the file.",
};

function useRemoveMutation(kind: Kind) {
  const dataroom = useMutation(trpc.dataroom.remove.mutationOptions());
  const folder = useMutation(trpc.folder.remove.mutationOptions());
  const file = useMutation(trpc.file.remove.mutationOptions());
  if (kind === "dataroom") {
    return dataroom;
  }
  if (kind === "folder") {
    return folder;
  }
  return file;
}

export function DeleteConfirmDialog({
  kind,
  target,
  onOpenChange,
  onDeleted,
}: DeleteConfirmDialogProps) {
  const queryClient = useQueryClient();
  const mutation = useRemoveMutation(kind);

  if (!target) {
    return null;
  }

  return (
    <AlertDialog onOpenChange={onOpenChange} open={Boolean(target)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{target.name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            {RECURSIVE_WARNING[kind]} This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={mutation.isPending}
            onClick={() =>
              mutation.mutate(
                { id: target.id },
                {
                  onSuccess: () => {
                    queryClient.invalidateQueries();
                    toast.success("Deleted");
                    onDeleted?.();
                    onOpenChange(false);
                  },
                  onError: (error) => toast.error(error.message),
                }
              )
            }
          >
            {mutation.isPending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

- [ ] **Step 3: Verify types & lint, then commit**

```bash
pnpm check-types && pnpm dlx ultracite check
git add apps/web/src/components/dataroom/rename-dialog.tsx apps/web/src/components/dataroom/delete-confirm-dialog.tsx
git commit -m "feat(web): shared rename and delete-confirm dialogs"
```

---

### Task 10: Explorer — contents, breadcrumbs, items, navigation, new folder

**Files:**
- Create: `apps/web/src/components/dataroom/breadcrumbs.tsx`
- Create: `apps/web/src/components/dataroom/folder-item.tsx`
- Create: `apps/web/src/components/dataroom/file-item.tsx`
- Create: `apps/web/src/components/dataroom/new-folder-dialog.tsx`
- Create: `apps/web/src/components/dataroom/explorer-toolbar.tsx`
- Create: `apps/web/src/components/dataroom/explorer.tsx`
- Modify: `apps/web/src/app/rooms/[dataroomId]/page.tsx`
- Modify: `apps/web/src/app/rooms/[dataroomId]/folders/[folderId]/page.tsx`

**Interfaces:**
- Consumes: `trpc.folder.contents`, `trpc.folder.breadcrumb`, `trpc.folder.create`.
- Produces: `<Explorer dataroomId folderId={string|null} />`; navigation to `/rooms/[id]` and `/rooms/[id]/folders/[folderId]`; `onOpenFile(file)` hook wired in Task 12.

- [ ] **Step 1: Breadcrumbs**

Create `apps/web/src/components/dataroom/breadcrumbs.tsx`:

```tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { trpc } from "@/utils/trpc";

export function Breadcrumbs({
  dataroomId,
  folderId,
}: {
  dataroomId: string;
  folderId: string | null;
}) {
  const breadcrumbQuery = useQuery({
    ...trpc.folder.breadcrumb.queryOptions({ folderId: folderId ?? "" }),
    enabled: folderId !== null,
  });

  return (
    <nav className="flex flex-wrap items-center gap-1 text-sm">
      <Link className="text-muted-foreground hover:text-foreground" href={`/rooms/${dataroomId}`}>
        Root
      </Link>
      {(breadcrumbQuery.data ?? []).map((crumb) => (
        <span className="flex items-center gap-1" key={crumb.id}>
          <span className="text-muted-foreground">/</span>
          <Link
            className="max-w-40 truncate text-muted-foreground hover:text-foreground"
            href={`/rooms/${dataroomId}/folders/${crumb.id}`}
          >
            {crumb.name}
          </Link>
        </span>
      ))}
    </nav>
  );
}
```

- [ ] **Step 2: Folder item**

Create `apps/web/src/components/dataroom/folder-item.tsx`:

```tsx
"use client";

import { Card } from "@tailored-tech/ui/components/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@tailored-tech/ui/components/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@tailored-tech/ui/components/tooltip";
import { Folder, MoreVertical } from "lucide-react";
import { useRouter } from "next/navigation";

export function FolderItem({
  dataroomId,
  id,
  name,
  onRename,
  onDelete,
}: {
  dataroomId: string;
  id: string;
  name: string;
  onRename: () => void;
  onDelete: () => void;
}) {
  const router = useRouter();
  const open = () => router.push(`/rooms/${dataroomId}/folders/${id}`);

  return (
    <Card className="flex items-center justify-between gap-2 p-3">
      <button
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
        onDoubleClick={open}
        onKeyDown={(event) => event.key === "Enter" && open()}
        type="button"
      >
        <Folder className="size-4 shrink-0 text-muted-foreground" />
        <Tooltip>
          <TooltipTrigger className="min-w-0 truncate">{name}</TooltipTrigger>
          <TooltipContent>{name}</TooltipContent>
        </Tooltip>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger className="text-muted-foreground hover:text-foreground">
          <MoreVertical className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-card">
          <DropdownMenuItem onClick={open}>Open</DropdownMenuItem>
          <DropdownMenuItem onClick={onRename}>Rename</DropdownMenuItem>
          <DropdownMenuItem onClick={onDelete} variant="destructive">
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </Card>
  );
}
```

- [ ] **Step 3: File item**

Create `apps/web/src/components/dataroom/file-item.tsx`:

```tsx
"use client";

import { Card } from "@tailored-tech/ui/components/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@tailored-tech/ui/components/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@tailored-tech/ui/components/tooltip";
import { FileText, MoreVertical } from "lucide-react";

export function FileItem({
  name,
  onOpen,
  onRename,
  onDelete,
}: {
  name: string;
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className="flex items-center justify-between gap-2 p-3">
      <button
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
        onDoubleClick={onOpen}
        onKeyDown={(event) => event.key === "Enter" && onOpen()}
        type="button"
      >
        <FileText className="size-4 shrink-0 text-muted-foreground" />
        <Tooltip>
          <TooltipTrigger className="min-w-0 truncate">{name}</TooltipTrigger>
          <TooltipContent>{name}</TooltipContent>
        </Tooltip>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger className="text-muted-foreground hover:text-foreground">
          <MoreVertical className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-card">
          <DropdownMenuItem onClick={onOpen}>Open</DropdownMenuItem>
          <DropdownMenuItem onClick={onRename}>Rename</DropdownMenuItem>
          <DropdownMenuItem onClick={onDelete} variant="destructive">
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </Card>
  );
}
```

- [ ] **Step 4: New folder dialog**

Create `apps/web/src/components/dataroom/new-folder-dialog.tsx`:

```tsx
"use client";

import { Button } from "@tailored-tech/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@tailored-tech/ui/components/dialog";
import { Input } from "@tailored-tech/ui/components/input";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FolderPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { trpc } from "@/utils/trpc";

export function NewFolderDialog({
  dataroomId,
  parentId,
}: {
  dataroomId: string;
  parentId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const queryClient = useQueryClient();

  const createMutation = useMutation(
    trpc.folder.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.folder.contents.queryKey({
            dataroomId,
            folderId: parentId,
          }),
        });
        toast.success("Folder created");
        setOpen(false);
        setName("");
      },
      onError: (error) => toast.error(error.message),
    })
  );

  const trimmed = name.trim();

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger render={<Button variant="outline" />}>
        <FolderPlus />
        New Folder
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Folder</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (trimmed) {
              createMutation.mutate({ dataroomId, parentId, name: trimmed });
            }
          }}
        >
          <Input
            autoFocus
            maxLength={255}
            onChange={(event) => setName(event.target.value)}
            placeholder="Financials"
            value={name}
          />
          <DialogFooter className="mt-4">
            <Button disabled={!trimmed || createMutation.isPending} type="submit">
              {createMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 5: Explorer toolbar**

Create `apps/web/src/components/dataroom/explorer-toolbar.tsx`:

```tsx
"use client";

import { NewFolderDialog } from "./new-folder-dialog";

export function ExplorerToolbar({
  dataroomId,
  folderId,
  children,
}: {
  dataroomId: string;
  folderId: string | null;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <NewFolderDialog dataroomId={dataroomId} parentId={folderId} />
      {children}
    </div>
  );
}
```

- [ ] **Step 6: Explorer**

Create `apps/web/src/components/dataroom/explorer.tsx`:

```tsx
"use client";

import { Empty } from "@tailored-tech/ui/components/empty";
import { Skeleton } from "@tailored-tech/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { trpc } from "@/utils/trpc";

import { Breadcrumbs } from "./breadcrumbs";
import { DeleteConfirmDialog } from "./delete-confirm-dialog";
import { ExplorerToolbar } from "./explorer-toolbar";
import { FileItem } from "./file-item";
import { FolderItem } from "./folder-item";
import { RenameDialog } from "./rename-dialog";

type Target = { id: string; name: string } | null;

export function Explorer({
  dataroomId,
  folderId,
}: {
  dataroomId: string;
  folderId: string | null;
}) {
  const contentsQuery = useQuery(
    trpc.folder.contents.queryOptions({ dataroomId, folderId })
  );
  const [renameFolder, setRenameFolder] = useState<Target>(null);
  const [deleteFolder, setDeleteFolder] = useState<Target>(null);
  const [renameFile, setRenameFile] = useState<Target>(null);
  const [deleteFile, setDeleteFile] = useState<Target>(null);

  const contents = contentsQuery.data;
  const isEmpty =
    contents && contents.folders.length === 0 && contents.files.length === 0;

  return (
    <main className="container mx-auto max-w-5xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <Breadcrumbs dataroomId={dataroomId} folderId={folderId} />
        <ExplorerToolbar dataroomId={dataroomId} folderId={folderId} />
      </div>

      {contentsQuery.isLoading ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-12" />
          <Skeleton className="h-12" />
        </div>
      ) : null}

      {isEmpty ? (
        <Empty>
          <p className="text-muted-foreground text-sm">
            This folder is empty. Create a folder or upload a PDF.
          </p>
        </Empty>
      ) : null}

      {contents && !isEmpty ? (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {contents.folders.map((folder) => (
            <FolderItem
              dataroomId={dataroomId}
              id={folder.id}
              key={folder.id}
              name={folder.name}
              onDelete={() =>
                setDeleteFolder({ id: folder.id, name: folder.name })
              }
              onRename={() =>
                setRenameFolder({ id: folder.id, name: folder.name })
              }
            />
          ))}
          {contents.files.map((file) => (
            <FileItem
              key={file.id}
              name={file.name}
              onDelete={() => setDeleteFile({ id: file.id, name: file.name })}
              onOpen={() => {
                // Wired to the PDF viewer in Task 12.
                window.open(file.blobUrl, "_blank", "noopener");
              }}
              onRename={() => setRenameFile({ id: file.id, name: file.name })}
            />
          ))}
        </div>
      ) : null}

      <RenameDialog
        kind="folder"
        onOpenChange={(next) => !next && setRenameFolder(null)}
        target={renameFolder}
      />
      <DeleteConfirmDialog
        kind="folder"
        onOpenChange={(next) => !next && setDeleteFolder(null)}
        target={deleteFolder}
      />
      <RenameDialog
        kind="file"
        onOpenChange={(next) => !next && setRenameFile(null)}
        target={renameFile}
      />
      <DeleteConfirmDialog
        kind="file"
        onOpenChange={(next) => !next && setDeleteFile(null)}
        target={deleteFile}
      />
    </main>
  );
}
```

- [ ] **Step 7: Wire the room pages to the explorer with a server guard**

Replace `apps/web/src/app/rooms/[dataroomId]/page.tsx`:

```tsx
import { auth } from "@tailored-tech/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Explorer } from "@/components/dataroom/explorer";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ dataroomId: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect("/login");
  }
  const { dataroomId } = await params;
  return <Explorer dataroomId={dataroomId} folderId={null} />;
}
```

Replace `apps/web/src/app/rooms/[dataroomId]/folders/[folderId]/page.tsx`:

```tsx
import { auth } from "@tailored-tech/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Explorer } from "@/components/dataroom/explorer";

export default async function FolderPage({
  params,
}: {
  params: Promise<{ dataroomId: string; folderId: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect("/login");
  }
  const { dataroomId, folderId } = await params;
  return <Explorer dataroomId={dataroomId} folderId={folderId} />;
}
```

- [ ] **Step 8: Verify in browser**

Run: `pnpm dev:web`. Open a data room → create nested folders → navigate in/out via breadcrumbs → rename/delete a folder. Stop the server.

- [ ] **Step 9: Verify types & lint, then commit**

```bash
pnpm check-types && pnpm dlx ultracite check
git add apps/web/src
git commit -m "feat(web): folder explorer with breadcrumbs, items, new folder, navigation"
```

---

### Task 11: File upload + PDF viewer

**Files:**
- Create: `apps/web/src/components/dataroom/file-uploader.tsx`
- Create: `apps/web/src/components/dataroom/pdf-viewer-dialog.tsx`
- Modify: `apps/web/src/components/dataroom/explorer.tsx` (add uploader to toolbar; open files in the viewer)

**Interfaces:**
- Consumes: `upload` (`@vercel/blob/client`), `trpc.file.create`, `MAX_UPLOAD_BYTES`, `ACCEPTED_MIME`, `Progress`, `Dialog*`.
- Produces: `<FileUploader dataroomId folderId />`; `<PdfViewerDialog file={{name,blobUrl}|null} onOpenChange />`.

- [ ] **Step 1: File uploader**

Create `apps/web/src/components/dataroom/file-uploader.tsx`:

```tsx
"use client";

import { Button } from "@tailored-tech/ui/components/button";
import { Progress } from "@tailored-tech/ui/components/progress";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { upload } from "@vercel/blob/client";
import { Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { ACCEPTED_MIME, MAX_UPLOAD_BYTES } from "@/lib/upload-constants";
import { trpc } from "@/utils/trpc";

export function FileUploader({
  dataroomId,
  folderId,
}: {
  dataroomId: string;
  folderId: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const createFile = useMutation(trpc.file.create.mutationOptions());

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: trpc.folder.contents.queryKey({ dataroomId, folderId }),
    });

  const handleFiles = async (files: FileList) => {
    for (const file of Array.from(files)) {
      if (file.type !== ACCEPTED_MIME) {
        toast.error(`${file.name}: only PDF files are allowed`);
        continue;
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        toast.error(`${file.name}: exceeds the 50 MB limit`);
        continue;
      }
      try {
        setProgress(0);
        const blob = await upload(file.name, file, {
          access: "public",
          handleUploadUrl: "/api/blob/upload",
          contentType: file.type,
          onUploadProgress: (event) => setProgress(event.percentage),
        });
        await createFile.mutateAsync({
          dataroomId,
          folderId,
          name: file.name,
          blobUrl: blob.url,
          blobPathname: blob.pathname,
          size: file.size,
          contentType: file.type,
        });
        toast.success(`${file.name} uploaded`);
        invalidate();
      } catch (error) {
        toast.error(`${file.name}: ${(error as Error).message}`);
      } finally {
        setProgress(null);
      }
    }
  };

  return (
    <>
      <input
        accept={ACCEPTED_MIME}
        className="hidden"
        multiple
        onChange={(event) => {
          if (event.target.files) {
            handleFiles(event.target.files);
            event.target.value = "";
          }
        }}
        ref={inputRef}
        type="file"
      />
      <Button
        disabled={progress !== null}
        onClick={() => inputRef.current?.click()}
      >
        <Upload />
        {progress === null ? "Upload" : `Uploading ${Math.round(progress)}%`}
      </Button>
      {progress !== null ? (
        <Progress className="w-24" value={progress} />
      ) : null}
    </>
  );
}
```

- [ ] **Step 2: PDF viewer dialog**

Create `apps/web/src/components/dataroom/pdf-viewer-dialog.tsx`:

```tsx
"use client";

import { Button } from "@tailored-tech/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@tailored-tech/ui/components/dialog";
import { Download, ExternalLink } from "lucide-react";

export function PdfViewerDialog({
  file,
  onOpenChange,
}: {
  file: { name: string; blobUrl: string } | null;
  onOpenChange: (open: boolean) => void;
}) {
  if (!file) {
    return null;
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={Boolean(file)}>
      <DialogContent className="h-[85vh] w-[90vw] max-w-4xl">
        <DialogHeader className="flex-row items-center justify-between">
          <DialogTitle className="truncate">{file.name}</DialogTitle>
          <div className="flex items-center gap-2">
            <a href={file.blobUrl} rel="noopener" target="_blank">
              <Button size="sm" variant="outline">
                <ExternalLink />
                Open
              </Button>
            </a>
            <a download={file.name} href={file.blobUrl}>
              <Button size="sm" variant="outline">
                <Download />
                Download
              </Button>
            </a>
          </div>
        </DialogHeader>
        <iframe
          className="h-full w-full border-0"
          src={file.blobUrl}
          title={file.name}
        />
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Wire uploader + viewer into the explorer**

In `apps/web/src/components/dataroom/explorer.tsx`:

Add imports:
```tsx
import { FileUploader } from "./file-uploader";
import { PdfViewerDialog } from "./pdf-viewer-dialog";
```

Add viewer state next to the other `useState` hooks:
```tsx
  const [viewFile, setViewFile] = useState<{
    name: string;
    blobUrl: string;
  } | null>(null);
```

Pass the uploader into the toolbar:
```tsx
        <ExplorerToolbar dataroomId={dataroomId} folderId={folderId}>
          <FileUploader dataroomId={dataroomId} folderId={folderId} />
        </ExplorerToolbar>
```

Change the file item `onOpen` to open the viewer instead of a new tab:
```tsx
              onOpen={() =>
                setViewFile({ name: file.name, blobUrl: file.blobUrl })
              }
```

Render the viewer near the other dialogs:
```tsx
      <PdfViewerDialog
        file={viewFile}
        onOpenChange={(next) => !next && setViewFile(null)}
      />
```

- [ ] **Step 4: Verify in browser**

Run: `pnpm dev:web`. Upload a PDF (appears in the grid), upload a non-PDF (rejected with toast), upload the same PDF twice (second becomes `name (1).pdf`), open a file (viewer shows it), download works. Stop the server.

- [ ] **Step 5: Verify types & lint, then commit**

```bash
pnpm check-types && pnpm dlx ultracite check
git add apps/web/src
git commit -m "feat(web): PDF upload to Vercel Blob and in-app PDF viewer"
```

---

### Task 12: Polish, edge cases, and full verification

**Files:**
- Modify: any component needing optimistic-update / focus / a11y touch-ups (as found during the pass)
- Modify: `README.md` (design decisions + setup)

**Interfaces:** none new.

- [ ] **Step 1: Run the full manual E2E checklist**

Run `pnpm dev:web` and verify every item from the spec's Verification section:
1. Auth gate (anonymous `/` → `/login`; sign up → home; sign out → `/login`).
2. Datarooms CRUD; delete removes rooms.
3. Nested folders + breadcrumbs; folder delete cascades.
4. File upload (PDF only, 50 MB guard), view, rename, delete.
5. Duplicate names → `(1)`.
6. Isolation with a second account (expect the room is not visible; direct `/rooms/<id>` of another user → tRPC `FORBIDDEN` surfaces as an error toast; server pages still render but queries fail — acceptable for MVP).
7. Confirm rows + blobs are gone after deletes via `pnpm db:studio`.

- [ ] **Step 2: Fix any issues found**

Apply targeted fixes (empty states, long-name truncation already handled via `truncate` + tooltip, disabled buttons during pending, toast on error). Keep changes minimal and focused.

- [ ] **Step 3: Update the README**

Rewrite `README.md` to document: what the app is, the design decisions (multi-dataroom, auth-gated, auto-suffix duplicates, client-upload to Blob, cascade + blob cleanup), setup steps (`pnpm install`, env vars incl. `BLOB_READ_WRITE_TOKEN`, `pnpm db:push`, `pnpm dev:web`), and the tech stack.

- [ ] **Step 4: Final type + lint gate**

Run: `pnpm dlx ultracite fix && pnpm check-types && pnpm dlx ultracite check && pnpm --filter @tailored-tech/api test`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: polish edge cases, a11y, and README for Data Room MVP"
```

---

### Task 13 (optional, extra credit): Name search/filter

**Files:**
- Modify: `apps/web/src/components/dataroom/explorer.tsx` (client-side name filter input)

- [ ] **Step 1: Add a filter input**

Add an `Input` above the grid bound to a `query` state; filter `contents.folders` and `contents.files` by `name.toLowerCase().includes(query.trim().toLowerCase())` before rendering. Show a "no matches" message when the filter yields nothing.

- [ ] **Step 2: Verify & commit**

```bash
pnpm check-types && pnpm dlx ultracite check
git add apps/web/src/components/dataroom/explorer.tsx
git commit -m "feat(web): client-side name filter in the explorer"
```

---

## Self-Review

**Spec coverage:**
- Folders create/nest/view/rename/delete → Tasks 5, 10, 9-shared. ✅
- Files upload/view/rename/delete → Tasks 6, 11, 9-shared. ✅
- Multi-dataroom CRUD → Tasks 4, 9. ✅
- Auth gate whole app → Task 7. ✅
- Vercel Blob client-upload + cleanup → Tasks 3 (helpers), 4/5/6 (`del`), 6/11 (route + client). ✅
- Duplicate auto-suffix → Task 3 (`resolveUniqueName`, tested) applied in 4/5/6. ✅
- Edge cases (PDF-only, size, long names, empty, isolation, confirm) → Tasks 6/11/10/9-shared/12. ✅
- Verification → Task 12. ✅
- Optional search → Task 13. ✅

**Placeholder scan:** No TBD/TODO left; every code step contains full code. The only forward-reference (home importing rename/delete dialogs) is resolved by the explicit "Task 9-shared" ordering note.

**Type consistency:** `resolveUniqueName(existing, desired, isFile)`, `assert*Owner(db, userId, id)`, `collectFolderBlobPathnames(db, folderId)`, `folder.contents({dataroomId, folderId})`, `folder.breadcrumb({folderId})`, and the `{ id, name }` `Target` shape are used identically across tasks. `RenameDialog`/`DeleteConfirmDialog` take `kind` + `target` consistently in home and explorer.

## Execution ordering note

Build order: Task 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → **9-shared** → 9 → 10 → 11 → 12 → (13). The "9-shared" dialogs must exist before Task 9 Step 3 compiles.
