import { del } from "@vercel/blob";
import { z } from "zod";

import { protectedProcedure, router } from "../index";
import { collectFolderBlobPathnames } from "../lib/blob";
import { assertDataroomOwner, assertFolderOwner } from "../lib/ownership";
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
