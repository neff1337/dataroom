import { auth } from "@tailored-tech/auth";
import db, { type Database } from "@tailored-tech/db";
import type { NextRequest } from "next/server";

// Annotate with the exported `Database` alias so the inferred `Context` type
// stays portable across packages (avoids TS2883 on the generated Prisma path).
const database: Database = db;

export async function createContext(req: NextRequest) {
  const session = await auth.api.getSession({
    headers: req.headers,
  });
  return {
    db: database,
    session,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
