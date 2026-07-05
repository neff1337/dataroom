# Data Room MVP — Design Spec

- **Date:** 2026-07-05
- **Status:** Approved (brainstorming)
- **Author:** brainstormed with the user

## Context

Take-home: build a Data Room SPA (Google Drive / Dropbox style) for securely storing and
organizing due-diligence documents. Core deliverable is CRUD for **folders** (nestable) and
**files** (PDF), with intuitive UX, clean design, and readable code.

The repo is an existing Better-T-Stack monorepo:

- **Next.js 16** App Router, React 19 (React Compiler on), `typedRoutes: true` — `apps/web`
- **tRPC v11** — `packages/api` (`publicProcedure`, `protectedProcedure`, per-request session context)
- **Better Auth** (email/password) — `packages/auth`, already wired end-to-end
- **Prisma 7** over **Neon Postgres** (`@prisma/adapter-pg`) — `packages/db`, generated client checked in
- **Vercel Blob** — provisioned by the user for file storage
- **shadcn/ui on `@base-ui/react`**, style `base-lyra` — `packages/ui`

**Auth is already fully implemented and working** (backend + sign-in/sign-up forms + session
guard + sign-out). We do not rebuild it — we reuse it and gate the whole app behind it.

### Requirements traceability (from the assignment)

- Folders: create, nest, view contents (nested files+folders), rename, delete (recursive). ✅
- Files: upload (PDF only, browser/blob storage), view in UI, rename, delete. ✅
- "Allow users to create **Datarooms**" → first-class multi-dataroom support. ✅
- Edge cases (e.g. duplicate names), good metadata/state structures, granular components. ✅
- Optional extra credit: hosting/blob (Vercel Blob — in), auth (done), name search (optional).

### Design decisions (agreed with the user)

1. **Multiple Data Rooms per user**, full CRUD. Home page (`/`) is the list of Data Rooms; a
   Data Room is the top-level "drive" that contains folders and files.
2. **Whole app behind auth.** Unauthenticated users are redirected to `/login`.
3. **Duplicate names in the same parent → auto-suffix `(1)`** (Google-Drive style), preserving
   file extension: `report.pdf` → `report (1).pdf`. Applied to datarooms, folders, files, on
   create / upload / rename.
4. **PDF viewing** happens in an in-app dialog (`<iframe>`), with "open in new tab" + download.
5. Name-based **search/filter is optional** (extra credit), scoped per Data Room.

## Non-goals (YAGNI)

Sharing / permissions / roles, file versioning, drag-and-drop move between folders, non-PDF
previews, full-text (content) search, real-time collaboration, trash/restore.

---

## Architecture

### Routes (`apps/web/src/app`)

| Route | Type | Purpose |
|---|---|---|
| `/login` | client (exists) | Sign-in / sign-up (public) |
| `/` | server | **Data Rooms home** — grid of the user's rooms + "New Data Room" |
| `/rooms/[dataroomId]` | server → client explorer | Room root: folders + files |
| `/rooms/[dataroomId]/folders/[folderId]` | server → client explorer | Nested folder view |
| `/api/auth/[...all]` | route (exists) | Better Auth |
| `/api/trpc/[trpc]` | route (exists) | tRPC fetch adapter |
| `/api/blob/upload` | route (new) | Vercel Blob client-upload token handler |

`middleware.ts` (new) redirects to `/login` when the Better Auth session cookie is absent.
Matcher excludes `/login`, `/api/auth`, `_next`, and static assets. This is an **optimistic**
UX redirect only; real authorization is enforced in every tRPC procedure.

### Data model (Prisma — new `packages/db/prisma/schema/dataroom.prisma`)

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
  parentId   String?                                     // null = dataroom root
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
  folderId     String?                                   // null = dataroom root
  folder       Folder?  @relation(fields: [folderId], references: [id], onDelete: Cascade)
  blobUrl      String                                    // public Vercel Blob URL
  blobPathname String                                    // storage pathname, needed for deletion
  size         Int
  contentType  String   @default("application/pdf")
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  @@index([dataroomId])
  @@index([folderId])
  @@map("file")
}
```

Add `datarooms Dataroom[]` to the existing `User` model in `auth.prisma`.

**Deletion semantics.** DB `onDelete: Cascade` (self-relation on folders, folder→file,
dataroom→folder/file) means deleting a room or folder removes all descendant rows
automatically. Vercel Blob objects are **not** covered by DB cascade, so a delete mutation
must first recursively collect the `blobPathname` of every descendant file and call Blob
`del()` on them, then delete the row (letting cascade clean the rest).

### Backend (tRPC — `packages/api/src`)

All procedures are `protectedProcedure`. Every query/mutation verifies the target belongs to
`ctx.session.user.id` before acting.

**Shared helpers (`packages/api/src/lib/`):**

- `assertDataroomOwner(ctx, dataroomId)` / `assertFolderOwner` / `assertFileOwner` — load the
  row, throw `TRPCError` `NOT_FOUND` (missing) or `FORBIDDEN` (not owner). Return the row.
- `resolveUniqueName(existingNames: string[], desired: string, isFile: boolean): string` —
  returns `desired` if free, else appends ` (n)` with the smallest free `n`; for files the
  suffix is inserted before the extension. Pure, unit-testable.
- `collectDescendantBlobPathnames(scope)` — given a folder id (or a whole dataroom id), returns
  the `blobPathname[]` of every file under it, recursively, for blob cleanup before delete.

**Routers (split into files under `packages/api/src/routers/`, composed in `index.ts`):**

- `dataroom`: `list()`, `create({name})`, `rename({id,name})`, `remove({id})` (blob cleanup).
- `folder`: `create({dataroomId,parentId?,name})`, `rename({id,name})`, `remove({id})`
  (recursive blob cleanup), `breadcrumb({folderId})` → ancestor chain for breadcrumbs.
- `file`: `create({dataroomId,folderId?,name,blobUrl,blobPathname,size,contentType})`,
  `rename({id,name})`, `remove({id})` (`del(blobPathname)`).
- `folder.contents({dataroomId, folderId: string | null})` → `{ folders, files }` for the
  current view (sorted: folders first, then files, name asc).

Remove the demo `privateData` procedure; keep `healthCheck` (harmless).

Input validation via Zod: names are trimmed, non-empty after trim, max length 255 chars.

### File upload (Vercel Blob, client-upload)

1. Browser calls `upload(name, file, { access: "public", handleUploadUrl: "/api/blob/upload", clientPayload })` from `@vercel/blob/client`.
2. `/api/blob/upload` uses `handleUpload`; in `onBeforeGenerateToken` it verifies the Better
   Auth session, sets `allowedContentTypes: ["application/pdf"]` and `maximumSizeInBytes`
   (50 MB, defined as a named constant shared with client-side pre-validation).
3. On success the client receives `{ url, pathname }` and calls `file.create` with metadata
   (server applies `resolveUniqueName` for collisions).

We register the DB row from the client after upload (not in `onUploadCompleted`) so it works
on localhost, where Blob cannot call back to a public URL. Add `BLOB_READ_WRITE_TOKEN` to
`packages/env/src/server.ts` and `apps/web/.env`.

### Frontend (granular components — `apps/web/src/components/dataroom/`)

Reuse existing `base-lyra` primitives: `button, input, card, empty, attachment, skeleton,
dropdown-menu, sonner (toast), label, tooltip`. Add via
`npx shadcn@latest add dialog alert-dialog breadcrumb context-menu progress -c packages/ui`.

- **Home:** `dataroom-grid`, `dataroom-card` (name, counts, updated-at, actions menu),
  `create-dataroom-dialog`, empty state.
- **Explorer:** `explorer` (client; TanStack Query `folder.contents`), `explorer-toolbar`
  (New Folder / Upload), `breadcrumbs` (from `folder.breadcrumb`).
- **Items:** `folder-item`, `file-item` (icon, truncated name + tooltip, actions menu,
  double-click to open/navigate).
- **Dialogs:** `new-folder-dialog`, `rename-dialog`, `delete-confirm-dialog` (alert-dialog),
  `pdf-viewer-dialog` (iframe + open-in-new-tab + download).
- **Upload:** `file-uploader` — drag-and-drop zone + `<input type="file" accept="application/pdf" multiple>`,
  per-file progress, PDF-only + size guard, errors surfaced as toasts.

State/UX: TanStack Query with optimistic updates + cache invalidation; `sonner` toasts for
success/error; `skeleton` while loading; `empty` component for empty rooms/folders.

## Error handling & edge cases

- Duplicate name (room/folder/file, same parent) → auto-suffix `(1)` server-side.
- Non-PDF or oversized upload → rejected at the blob token step and pre-validated client-side; toast.
- Long names → CSS truncation + tooltip with full name.
- Empty states for zero rooms / empty folder.
- Cross-user isolation → ownership checks return `NOT_FOUND`/`FORBIDDEN`.
- Destructive actions (delete room/folder/file) require confirmation and warn about recursive delete.
- Network/mutation failures → toast with retry where sensible (query cache already wires retry).

## Testing / Verification

No test runner is configured in the repo; `resolveUniqueName` is the one pure unit worth a
lightweight test if we add a runner, otherwise verified via the E2E pass below.

Manual end-to-end (`pnpm dev:web`, http://localhost:3001):

1. **Auth gate:** anonymous `/` → redirect `/login`; sign up → land on home; sign out → `/login`.
2. **Datarooms:** create, rename, delete a room; deleting removes its folders/files (+ blobs).
3. **Folders:** create nested folders; navigate in/out via breadcrumbs; rename; delete →
   descendants gone (verify rows + blobs in `pnpm db:studio`).
4. **Files:** upload PDF; reject non-PDF; view in dialog; rename; delete → row + blob gone.
5. **Edge cases:** upload two same-named files in one folder → second becomes `name (1).pdf`;
   same for folders/rooms; very long names; empty states.
6. **Isolation:** second account cannot see or mutate the first account's rooms.
7. `pnpm check-types` and `pnpm dlx ultracite check` pass.

## Implementation phases (for the plan)

0. Foundations — install `@vercel/blob`; add `BLOB_READ_WRITE_TOKEN` env; verify auth E2E.
1. Data model — `dataroom.prisma` + `User.datarooms`; `db:push` + `db:generate`.
2. Auth gate + route shells — `middleware.ts`; `/`, `/rooms/[id]`, `.../folders/[folderId]`; remove demo pages.
3. Backend — ownership + unique-name helpers; dataroom/folder/file routers; `contents`, `breadcrumb`; `/api/blob/upload`.
4. Datarooms home UI — grid, create/rename/delete, empty/loading states.
5. Explorer UI — contents, breadcrumbs, items, navigation, new folder, rename, delete.
6. Upload + PDF viewer — `file-uploader`, `file.create` wiring, `pdf-viewer-dialog`.
7. Polish & edge cases — optimistic updates, toasts, a11y, duplicates, long names; `ultracite fix`, `check-types`.
8. (Optional) name search/filter; README with design decisions; deploy to Vercel.
