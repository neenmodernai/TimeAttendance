// src/lib/changes.ts
// Policy changes HR makes are queued here for the owner to approve. Owner changes apply at once (and are logged).
import { randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { db } from "./db";
import { appUrl, btn, esc, sendMail, wrap } from "./mail";
import { fmtDays, LeaveTypeRow } from "./quota";
import { makeToken, readToken, Role } from "./session";

export type LeaveTypePayload = Omit<LeaveTypeRow, never> & { before?: LeaveTypeRow | null };
export type QuotaPayload = { employee_id: string; employee_name: string; leave_type: string; type_name: string; annual_days: number | null; before?: number | null };
export type ChangeKind = "leave_type" | "employee_quota";
export type ChangeRow = {
  id: string; kind: ChangeKind; payload: LeaveTypePayload | QuotaPayload; summary: string; requested_by: string;
  status: "pending" | "approved" | "rejected"; owner_note: string | null; created_at: string; decided_at: string | null; decided_by: string | null;
};

const TTL = 14 * 86400_000;
export const changeToken = (id: string) => makeToken("change:" + id, TTL);
export const changeIdFromToken = (t: string) => { const d = readToken(t); return d?.startsWith("change:") ? d.slice(7) : null; };
export const newTypeCode = () => "t_" + randomBytes(4).toString("hex"); // e.g. t_9f2c1a0b

const yesno = (b: boolean) => (b ? "ใช่" : "ไม่");
export function describeLeaveType(p: LeaveTypePayload): string {
  const b = p.before;
  if (!b) return `เพิ่มประเภทการลา “${p.name_th}” สิทธิ์ ${fmtDays(p.annual_days)} วัน/ปี${p.allow_over ? " (ลาเกินได้)" : ""}`;
  const d: string[] = [];
  if (b.name_th !== p.name_th) d.push(`ชื่อ “${b.name_th}” → “${p.name_th}”`);
  if (b.annual_days !== p.annual_days) d.push(`สิทธิ์ ${fmtDays(b.annual_days)} → ${fmtDays(p.annual_days)} วัน/ปี`);
  if (b.allow_over !== p.allow_over) d.push(`ลาเกินสิทธิ์ได้: ${yesno(b.allow_over)} → ${yesno(p.allow_over)}`);
  if (b.active !== p.active) d.push(p.active ? "เปิดใช้งาน" : "ปิดใช้งาน");
  if (b.sort !== p.sort) d.push(`ลำดับ ${b.sort} → ${p.sort}`);
  return `แก้ไข “${b.name_th}”: ${d.join(", ") || "ไม่มีการเปลี่ยนแปลง"}`;
}
export function describeQuota(p: QuotaPayload): string {
  return p.annual_days === null
    ? `${p.employee_name}: ยกเลิกสิทธิ์${p.type_name}เฉพาะคน (กลับไปใช้ค่าปกติ)`
    : `${p.employee_name}: สิทธิ์${p.type_name}เฉพาะคน ${p.before === null || p.before === undefined ? "ค่าปกติ" : fmtDays(p.before)} → ${fmtDays(p.annual_days)} วัน/ปี`;
}

async function apply(kind: ChangeKind, payload: LeaveTypePayload | QuotaPayload, sb: SupabaseClient) {
  if (kind === "leave_type") {
    const { before: _b, ...t } = payload as LeaveTypePayload;
    return sb.from("leave_types").upsert(t, { onConflict: "code" });
  }
  const p = payload as QuotaPayload;
  if (p.annual_days === null) return sb.from("employee_leave_quotas").delete().eq("employee_id", p.employee_id).eq("leave_type", p.leave_type);
  return sb.from("employee_leave_quotas").upsert({ employee_id: p.employee_id, leave_type: p.leave_type, annual_days: p.annual_days }, { onConflict: "employee_id,leave_type" });
}

/** HR: queue for owner + email the owner. Owner: apply now and log it as approved. */
export async function submitChange(kind: ChangeKind, payload: LeaveTypePayload | QuotaPayload, role: Role, sb: SupabaseClient = db()) {
  const summary = kind === "leave_type" ? describeLeaveType(payload as LeaveTypePayload) : describeQuota(payload as QuotaPayload);
  if (role === "owner") {
    const { error } = await apply(kind, payload, sb);
    if (error) return { ok: false as const, error: error.message };
    await sb.from("change_requests").insert({ kind, payload, summary, requested_by: "owner", status: "approved", decided_at: new Date().toISOString(), decided_by: "owner" });
    return { ok: true as const, applied: true, summary };
  }
  const { data, error } = await sb.from("change_requests").insert({ kind, payload, summary, requested_by: "hr" }).select("id").single();
  if (error) return { ok: false as const, error: error.message };
  const to = process.env.OWNER_EMAIL;
  if (to) {
    const link = `${appUrl()}/owner/change/${changeToken(data.id)}`;
    await sendMail(to, `[รออนุมัติ] HR ขอเปลี่ยนนโยบายการลา`, wrap(`
      <h2 style="margin:0 0 8px">HR ขอเปลี่ยนแปลง รอคุณอนุมัติ</h2>
      <p style="font-size:15px">${esc(summary)}</p>
      ${btn(`${link}?d=approved`, "✓ อนุมัติ", "#16a34a")}${btn(`${link}?d=rejected`, "✗ ไม่อนุมัติ", "#dc2626")}
      <p style="font-size:12px;color:#94a3b8">ลิงก์ใช้ได้ 14 วัน · หรือดูที่ ${esc(appUrl())}/admin/approvals</p>`));
  }
  return { ok: true as const, applied: false, summary };
}

/** Owner decision on a queued change. Only pending requests can be decided. */
export async function decideChange(id: string, decision: "approved" | "rejected", by: string, note: string | null, sb: SupabaseClient = db()) {
  const { data: cr } = await sb.from("change_requests").select("*").eq("id", id).eq("status", "pending").maybeSingle();
  if (!cr) return { ok: false as const, error: "ไม่พบคำขอ หรือดำเนินการไปแล้ว" };
  if (decision === "approved") {
    const { error } = await apply(cr.kind, cr.payload, sb);
    if (error) return { ok: false as const, error: error.message };
  }
  await sb.from("change_requests").update({ status: decision, decided_at: new Date().toISOString(), decided_by: by, owner_note: note }).eq("id", id);
  return { ok: true as const };
}

export async function getChange(id: string, sb: SupabaseClient = db()): Promise<ChangeRow | null> {
  const { data } = await sb.from("change_requests").select("*").eq("id", id).maybeSingle();
  return (data as ChangeRow) ?? null;
}
