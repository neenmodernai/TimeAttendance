// src/lib/session.ts
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

type Kind = "emp" | "admin";
type Payload = { k: Kind; sub?: string; exp: number };
const NAME: Record<Kind, string> = { emp: "att_emp", admin: "att_admin" };

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET must be set (32+ chars)");
  return s;
}
const mac = (body: string) => createHmac("sha256", secret()).update(body).digest("base64url");

function sign(p: Payload) {
  const body = Buffer.from(JSON.stringify(p)).toString("base64url");
  return `${body}.${mac(body)}`;
}
function read(kind: Kind): Payload | null {
  const t = cookies().get(NAME[kind])?.value;
  if (!t) return null;
  const [body, sig] = t.split(".");
  if (!body || !sig) return null;
  const a = Buffer.from(sig), b = Buffer.from(mac(body));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as Payload;
    return p.k === kind && p.exp > Date.now() ? p : null;
  } catch { return null; }
}

/** Signed, expiring token for one-off links (e.g. HR email approval). */
export function makeToken(data: string, ttlMs: number): string {
  const body = Buffer.from(JSON.stringify({ d: data, exp: Date.now() + ttlMs })).toString("base64url");
  return `${body}.${mac(body)}`;
}
export function readToken(t: string): string | null {
  const [body, sig] = (t ?? "").split(".");
  if (!body || !sig) return null;
  const a = Buffer.from(sig), b = Buffer.from(mac(body));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as { d: string; exp: number };
    return p.exp > Date.now() ? p.d : null;
  } catch { return null; }
}

/** Constant-time admin password check (ADMIN_PASSWORD env). */
export function checkAdminPassword(pw: string): boolean {
  const real = process.env.ADMIN_PASSWORD ?? "";
  if (!real) return false;
  const h = (s: string) => createHmac("sha256", "pw").update(s).digest();
  return timingSafeEqual(h(pw), h(real));
}

/** days = 0 -> browser-session cookie */
export function setSession(kind: Kind, sub: string | undefined, days: number) {
  const ttl = (days || 1) * 86400_000;
  cookies().set(NAME[kind], sign({ k: kind, sub, exp: Date.now() + ttl }), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/",
    ...(days ? { maxAge: days * 86400 } : {}),
  });
}
export const clearSession = (kind: Kind) => cookies().delete(NAME[kind]);
export const getEmployeeId = () => read("emp")?.sub ?? null;
export const isAdmin = () => read("admin") !== null;
