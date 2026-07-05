import { publicProcedure, router } from "../index";
import { dataroomRouter } from "./dataroom";
import { fileRouter } from "./file";
import { folderRouter } from "./folder";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => "OK"),
  dataroom: dataroomRouter,
  folder: folderRouter,
  file: fileRouter,
});
export type AppRouter = typeof appRouter;
