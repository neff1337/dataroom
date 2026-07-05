import { TRPCError } from "@trpc/server";
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

const BLOB_HOST_SUFFIX = "blob.vercel-storage.com";

function isVercelBlobUrl(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith(BLOB_HOST_SUFFIX);
  } catch {
    return false;
  }
}

export const fileRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        dataroomId: z.string(),
        folderId: z.string().nullable(),
        name,
        blobUrl: z.url().refine(isVercelBlobUrl, "Not a Vercel Blob URL"),
        blobPathname: z.string().min(1),
        // size is client-reported display metadata only, never trusted for auth.
        size: z.number().int().nonnegative(),
        contentType: z.literal("application/pdf").default("application/pdf"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertDataroomOwner(ctx.db, ctx.session.user.id, input.dataroomId);
      if (input.folderId) {
        await assertFolderOwner(ctx.db, ctx.session.user.id, input.folderId);
      }
      // The blob must live under this user's namespace so a spoofed pathname
      // can never cause del() to touch another tenant's blob on delete.
      if (!input.blobPathname.startsWith(`${ctx.session.user.id}/`)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Blob path outside your namespace",
        });
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
