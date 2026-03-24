import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/app/generated/prisma/client";
import { getEnv } from "@/lib/env";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrisma(): PrismaClient {
  const { DATABASE_URL } = getEnv();
  const adapter = new PrismaPg({ connectionString: DATABASE_URL });
  return new PrismaClient({ adapter });
}

function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrisma();
  }
  return globalForPrisma.prisma;
}

/** Lazy singleton so `next build` does not require a live DB or full env at compile time. */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrisma();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
