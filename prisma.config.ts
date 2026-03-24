import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadEnvFile } from "dotenv";
import { defineConfig } from "prisma/config";

// Load .env from cwd (explicit paths; more reliable than import "dotenv/config" alone)
for (const name of [".env", ".env.local"] as const) {
  const p = resolve(process.cwd(), name);
  if (existsSync(p)) {
    loadEnvFile({ path: p, override: name === ".env.local" });
  }
}

const databaseUrl = process.env.DATABASE_URL?.trim();

const needsUrl =
  process.argv.includes("migrate") ||
  (process.argv.includes("db") && process.argv.includes("push"));

if (needsUrl && !databaseUrl) {
  throw new Error(
    "DATABASE_URL is missing or empty. Set it in .env (local) or on your host: Railway → web service → Variables (e.g. reference ${{Postgres.DATABASE_URL}}). Pre-deploy runs in a separate container but should receive the same variables—confirm DATABASE_URL is defined on that service, not only on Postgres.",
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
});
