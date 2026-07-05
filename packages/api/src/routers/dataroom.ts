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
