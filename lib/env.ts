import { Buffer } from "node:buffer";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  NEXT_PUBLIC_APP_URL: z
    .string()
    .url()
    .transform((s) => s.replace(/\/+$/, "")),
  TOKEN_ENCRYPTION_KEY: z
    .string()
    .min(1)
    .superRefine((val, ctx) => {
      try {
        const buf = Buffer.from(val, "base64");
        if (buf.length !== 32) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              "TOKEN_ENCRYPTION_KEY must be base64 that decodes to exactly 32 bytes (e.g. openssl rand -base64 32).",
          });
        }
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "TOKEN_ENCRYPTION_KEY must be valid base64.",
        });
      }
    }),
  ADMIN_SECRET: z.string().min(8),
  MICROSOFT_CLIENT_ID: z.string().optional(),
  MICROSOFT_CLIENT_SECRET: z.string().optional(),
  MICROSOFT_TENANT_ID: z.string().default("common"),
  ZOOM_ACCOUNT_ID: z.string().optional(),
  ZOOM_CLIENT_ID: z.string().optional(),
  ZOOM_CLIENT_SECRET: z.string().optional(),
});

export type AppEnv = z.infer<typeof schema>;

let cached: AppEnv | null = null;

export function getEnv(): AppEnv {
  if (!cached) {
    cached = schema.parse(process.env);
  }
  return cached;
}

export function requireMicrosoftConfig() {
  const e = getEnv();
  if (!e.MICROSOFT_CLIENT_ID) {
    throw new Error("MICROSOFT_CLIENT_ID is not set");
  }
  return {
    clientId: e.MICROSOFT_CLIENT_ID,
    clientSecret: e.MICROSOFT_CLIENT_SECRET,
    tenantId: e.MICROSOFT_TENANT_ID,
  };
}

export function requireZoomConfig() {
  const e = getEnv();
  if (!e.ZOOM_ACCOUNT_ID || !e.ZOOM_CLIENT_ID || !e.ZOOM_CLIENT_SECRET) {
    throw new Error(
      "Zoom Server-to-Server OAuth env vars missing: ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET",
    );
  }
  return {
    accountId: e.ZOOM_ACCOUNT_ID,
    clientId: e.ZOOM_CLIENT_ID,
    clientSecret: e.ZOOM_CLIENT_SECRET,
  };
}
