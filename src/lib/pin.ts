// src/lib/pin.ts
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

// Format: scrypt$N$r$p$saltB64$hashB64  (same as scripts/build_import.py)
export function hashPin(pin: string): string {
  const salt = randomBytes(16);
  const h = scryptSync(pin, salt, 32, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt.toString("base64")}$${h.toString("base64")}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const [alg, N, r, p, salt, hash] = stored.split("$");
  if (alg !== "scrypt") return false;
  const expected = Buffer.from(hash, "base64");
  const got = scryptSync(pin, Buffer.from(salt, "base64"), expected.length, { N: +N, r: +r, p: +p });
  return timingSafeEqual(got, expected);
}

export const validPin = (s: unknown): s is string => typeof s === "string" && /^\d{3,6}$/.test(s);
