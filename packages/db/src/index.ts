import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "@tailored-tech/env/server";

import { PrismaClient } from "../prisma/generated/client";

/** Public, portable alias for the Prisma client type used across packages. */
export type Database = PrismaClient;

export function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: env.DATABASE_URL,
  });
  return new PrismaClient({ adapter });
}

const prisma = createPrismaClient();
export default prisma;
