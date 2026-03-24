import { createHash } from "node:crypto";

/** Two signed 32-bit keys for `pg_advisory_xact_lock(int, int)`. */
export function slotAdvisoryKeys(startUtc: Date, endUtc: Date): [number, number] {
  const buf = createHash("sha256")
    .update(`${startUtc.toISOString()}\0${endUtc.toISOString()}`)
    .digest();
  return [buf.readInt32BE(0), buf.readInt32BE(4)];
}
