// src/lib/reminders.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { db, getSettings } from "./db";
import { appUrl, btn, esc, sendMail, wrap } from "./mail";
import { todayBoard } from "./report";
import { bkkDate, isoWeekday, thDate } from "./time";

export type ReminderKind = "morning" | "evening";

/**
 * morning: active staff with no punch today (and not on approved leave) -> reminded + listed to HR
 * evening: checked in but never checked out -> reminded + listed to HR
 * dry = true only reports who WOULD be contacted.
 */
export async function runReminders(kind: ReminderKind, opts: { dry?: boolean; force?: boolean; sb?: SupabaseClient } = {}) {
  const sb = opts.sb ?? db();
  const today = bkkDate();
  const s = await getSettings(sb);
  const base = { date: today, kind };
  if (!opts.force) {
    if (!s.remindEnabled) return { ...base, skipped: "reminders disabled in settings" };
    if (!s.workDays.includes(isoWeekday(today)) || s.holidays.includes(today)) return { ...base, skipped: "not a work day" };
  }
  const board = await todayBoard(sb);
  const targets = board.filter((r) => (kind === "morning" ? r.state === "none" : r.state === "in" || r.state === "late"));
  const list = targets.map((t) => ({ name: t.name, email: t.email }));
  if (opts.dry) return { ...base, dry: true, targets: list };

  const text = kind === "morning"
    ? { subj: "⏰ คุณยังไม่ได้ลงเวลาเข้างานวันนี้", body: `ระบบยังไม่พบการลงเวลาเข้างานของคุณวันนี้ (เข้างานตั้งแต่ ${s.lateFrom} ถือว่าสาย) กรุณาลงเวลาทันที หากลาให้แจ้งลาในระบบ`, label: "ลงเวลาเข้างาน" }
    : { subj: "⏰ อย่าลืมลงเวลาออกงาน", body: "ระบบพบว่าคุณลงเวลาเข้างานแล้วแต่ยังไม่ได้ลงเวลาออกงานวันนี้ กรุณาลงเวลาออกงาน", label: "ลงเวลาออกงาน" };
  let emailed = 0;
  for (const t of targets) {
    if (!t.email) continue;
    const { error } = await sb.from("notification_log").insert({ kind, employee_id: t.id, for_date: today });
    if (error) continue; // already sent today (unique violation)
    const ok = await sendMail(t.email, text.subj, wrap(`<h2 style="margin:0 0 8px">${esc(t.name)}</h2><p>${esc(text.body)}</p>${btn(appUrl(), text.label, "#4f46e5")}
      <p style="font-size:12px;color:#94a3b8">รายชื่อผู้ที่ไม่ได้ลงเวลาถูกส่งให้ HR ทุกวัน</p>`));
    if (ok) emailed++;
  }
  let digest = false;
  if (targets.length && s.hrEmail) {
    const li = targets.map((t) => `<li>${esc(t.name)}${t.dept ? ` (${esc(t.dept)})` : ""}${t.email ? "" : " <i style='color:#94a3b8'>— ไม่มีอีเมลในระบบ</i>"}</li>`).join("");
    digest = await sendMail(s.hrEmail, `[${kind === "morning" ? "ไม่ลงเวลาเข้า" : "ไม่ลงเวลาออก"}] ${targets.length} คน · ${thDate(today)}`,
      wrap(`<h2 style="margin:0 0 8px">${kind === "morning" ? "ยังไม่ลงเวลาเข้างาน" : "ลงเวลาเข้าแล้วแต่ยังไม่ออกงาน"} (${targets.length} คน)</h2><ul>${li}</ul>
        ${btn(appUrl() + "/admin", "เปิดหน้า HR", "#4f46e5")}`));
  }
  return { ...base, targets: list, emailed, digest };
}
