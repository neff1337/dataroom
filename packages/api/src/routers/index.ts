import { protectedProcedure, publicProcedure, router } from "../index";
import { dataroomRouter } from "./dataroom";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => "OK"),
  privateData: protectedProcedure.query(({ ctx }) => ({
    message: "This is private",
    user: ctx.session.user,
  })),
  dataroom: dataroomRouter,
});
export type AppRouter = typeof appRouter;
