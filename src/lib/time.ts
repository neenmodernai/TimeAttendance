// src/lib/time.ts  -- everything is displayed in Bangkok time (GMT+7)
const TZ = "Asia/Bangkok";

export const bkkDate = (d: Date | string = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(d)); // YYYY-MM-DD

export const bkkTime = (d: Date | string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(d));

export function addDays(ymd: string, n: number) {
  const d = new Date(ymd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
/** ISO weekday: Mon=1 ... Sun=7 */
export function isoWeekday(ymd: string) {
  const w = new Date(ymd + "T00:00:00Z").getUTCDay();
  return w === 0 ? 7 : w;
}
export function monthBounds(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const start = `${ym}-01`;
  const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  return { start, end };
}
export const thDate = (ymd: string) =>
  new Intl.DateTimeFormat("th-TH", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short", year: "2-digit" }).format(new Date(ymd + "T00:00:00Z"));
export const thMonth = (ym: string) =>
  new Intl.DateTimeFormat("th-TH", { timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(ym + "-01T00:00:00Z"));
