// src/lib/leave.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { db, getSettings } from "./db";
import { appUrl, btn, esc, sendMail, wrap } from "./mail";
import { makeToken, readToken } from "./session";
import { thDate } from "./time";
import { LeaveType, STATUS_TH, LeaveStatus } from "./types";
import { fmtDays, quotaFor } from "./quota";

const TTL = 14 * 86400_000;
export const leaveToken = (id: string) => makeToken("leave:" + id, TTL);
export const leaveIdFromToken = (t: string) => { const d = readToken(t); return d?.startsWith("leave:") ? d.slice(6) : null; };

export type LeaveRow = {
  id: string; employee_id: string; leave_type: LeaveType; over_quota: boolean; leave_types: { name_th: string } | null; start_date: string; days: number; reason: string | null; contact: string | null;
  email: string | null; dept: string | null; status: LeaveStatus; employees: { name: string; email: string | null } | null;
};
const SEL = "id,employee_id,leave_type,over_quota,start_date,days,reason,contact,email,dept,status,employees(name,email),leave_types(name_th)";
export const leaveName = (l: Pick<LeaveRow, "leave_type" | "leave_types">) => l.leave_types?.name_th ?? l.leave_type;

/** "used 2 + pending 1 / 3 days" line for the request's type and year. */
export async function quotaLine(l: LeaveRow, sb: SupabaseClient = db()) {
  const q = (await quotaFor(l.employee_id, Number(l.start_date.slice(0, 4)), sb)).find((x) => x.code === l.leave_type);
  if (!q) return "";
  return q.limit === null ? `ไม่จำกัด (ใช้ไป ${fmtDays(q.used)} วัน)` : `ใช้ ${fmtDays(q.used)} + รออนุมัติ ${fmtDays(q.pending)} จาก ${fmtDays(q.limit)} วัน · เหลือ ${fmtDays(q.remaining)}`;
}

export async function getLeave(id: string, sb: SupabaseClient = db()): Promise<LeaveRow | null> {
  const { data } = await sb.from("leave_requests").select(SEL).eq("id", id).maybeSingle();
  return (data as unknown as LeaveRow) ?? null;
}

/** Emails HR a request with Approve / Deny links. Returns whether an email went out. */
export async function notifyHr(id: string, sb: SupabaseClient = db()): Promise<boolean> {
  const [l, s] = await Promise.all([getLeave(id, sb), getSettings(sb)]);
  if (!l || !s.hrEmail) return false;
  const quota = await quotaLine(l, sb);
  const link = `${appUrl()}/hr/leave/${leaveToken(id)}`;
  const row = (k: string, v: string) => `<tr><td style="padding:4px 12px 4px 0;color:#64748b">${k}</td><td style="padding:4px 0">${esc(v)}</td></tr>`;
  const html = wrap(`
    <h2 style="margin:0 0 8px">คำขอลาใหม่ รออนุมัติ</h2>
    <table style="font-size:15px;margin-bottom:12px">
      ${row("พนักงาน", `${l.employees?.name ?? "-"}${l.dept ? " (" + l.dept + ")" : ""}`)}
      ${row("ประเภท", leaveName(l))}
      ${row(`สิทธิ์ปี ${l.start_date.slice(0, 4)}`, (l.over_quota ? "⚠️ เกินสิทธิ์ · " : "") + quota)}
      ${row("เริ่มลา", thDate(l.start_date))}
      ${row("จำนวน", `${l.days} วัน`)}
      ${row("เหตุผล", l.reason ?? "-")}
      ${row("ติดต่อ", l.contact ?? "-")}
    </table>
    ${btn(`${link}?d=approved`, "✓ อนุมัติ", "#16a34a")}${btn(`${link}?d=denied`, "✗ ไม่อนุมัติ", "#dc2626")}
    <p style="font-size:12px;color:#94a3b8">ลิงก์ใช้ได้ 14 วัน และต้องกดยืนยันบนหน้าเว็บอีกครั้ง · หรืออนุมัติที่ ${esc(appUrl())}/admin/leaves</p>`);
  const ok = await sendMail(s.hrEmail, `[ขอลา${l.over_quota ? " เกินสิทธิ์" : ""}] ${l.employees?.name ?? ""} · ${leaveName(l)} ${l.days} วัน (${thDate(l.start_date)})`, html);
  if (ok) await sb.from("leave_requests").update({ hr_notified_at: new Date().toISOString() }).eq("id", id);
  return ok;
}

/** Records a decision (only the admin can move something back to pending) and tells the employee. */
export async function applyDecision(id: string, decision: LeaveStatus, by: string, sb: SupabaseClient = db()) {
  const { error } = await sb.from("leave_requests").update({
    status: decision, decided_at: decision === "pending" ? null : new Date().toISOString(), decided_by: decision === "pending" ? null : by,
  }).eq("id", id);
  if (error || decision === "pending") return;
  const l = await getLeave(id, sb);
  const to = l?.email || l?.employees?.email;
  if (l && to) {
    await sendMail(to, `ผลการขอลา: ${STATUS_TH[decision]} (${leaveName(l)} ${thDate(l.start_date)})`, wrap(`
      <h2 style="margin:0 0 8px">ผลการขอลาของคุณ: ${decision === "approved" ? "✅" : "❌"} ${STATUS_TH[decision]}</h2>
      <p>${esc(leaveName(l))} ${l.days} วัน เริ่ม ${esc(thDate(l.start_date))}</p>
      <p style="color:#64748b">สิทธิ์${esc(leaveName(l))}ปีนี้: ${esc(await quotaLine(l, sb))}</p>`));
  }
}
