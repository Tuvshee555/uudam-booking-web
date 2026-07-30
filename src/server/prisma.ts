import { PrismaClient } from "@prisma/client";

/**
 * Single Prisma client per server instance.
 *
 * On Vercel every route handler can spin up in its own lambda, and Next's dev
 * server re-evaluates modules on each edit — both would otherwise open a new
 * pool on every reload and exhaust the database's connection limit. Stashing
 * the client on `globalThis` keeps exactly one per process.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
