import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";

function keyFromB64(keyB64: string): Buffer {
  const key = Buffer.from(keyB64, "base64");
  if (key.length !== 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY must be base64 for exactly 32 bytes");
  }
  return key;
}

/** Returns base64(iv + tag + ciphertext) suitable for DB storage. */
export function encryptString(plain: string, keyB64: string): string {
  const key = keyFromB64(keyB64);
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptString(blobB64: string, keyB64: string): string {
  const key = keyFromB64(keyB64);
  const buf = Buffer.from(blobB64, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    "utf8",
  );
}
