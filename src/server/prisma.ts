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

function isTransientPrismaError(err: unknown) {
  if (!(err instanceof Error)) return false;

  const message = err.message.toLowerCase();
  const name = err.name.toLowerCase();

  // The Neon serverless driver (@neondatabase/serverless) reports a dropped
  // pooled connection as `Error { kind: 'Closed', cause: ... }` inside the
  // Prisma error message, not as any of the engine's own wording above — an
  // admin save hitting this got zero retries and failed outright even though
  // the very next attempt would succeed.
  return (
    name.includes("prismaclientinitializationerror") ||
    message.includes("can't reach database server") ||
    message.includes("connection timed out") ||
    message.includes("connection terminated") ||
    message.includes("connection refused") ||
    message.includes("kind: closed") ||
    message.includes("kind: 'closed'")
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Neon can occasionally reject or time out the first pooled connection from a
 * cold local dev server. Give transient connection failures a short retry
 * window before surfacing them to the route handler.
 */
export async function withPrismaRetry<T>(
  operation: () => Promise<T>,
  { attempts = 3, delayMs = 750 }: { attempts?: number; delayMs?: number } = {},
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (err) {
      lastError = err;
      if (attempt === attempts || !isTransientPrismaError(err)) break;
      await sleep(delayMs * attempt);
    }
  }

  throw lastError;
}
