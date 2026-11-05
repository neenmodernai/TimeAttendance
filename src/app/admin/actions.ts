// src/app/admin/actions.ts
"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { hashPin, validPin } from "@/lib/pin";
import { clearSession, getRole, isAdmin, isOwner, roleForPassword, setSession } from "@/lib/session";
import { decideChange as decideChangeLib, newTypeCode, submitChange } from "@/lib/changes";
import { applyDecision } from "@/lib/leave";
import { bkkDate } from "@/lib/time";
import { DEPTS } from "@/lib/types";
import { getLeaveTypes, quotaFor } from "@/lib/quota";

const back = (path: string, msg: string, key: "e" | "ok" = "e") => redirect(`${path}?${key}=${encodeURIComponent(msg)}`);

function guard() { if (!isAdmin()) redirect("/admin/login"); }

export async function adminLogin(fd: FormData) {
  const role = roleForPassword(String(fd.get("password") ?? ""));
  if (!role) {
    await new Promise((r) => setTimeout(r, 1000)); // slow down guessing
    redirect("/admin/login?e=1");
  }
  setSession("admin", role, 0.5); // 12 hours
  redirect("/admin");
}

export async function adminLogout() { clearSession("admin"); redirect("/admin/login"); }

export async function decideLeave(fd: FormData) {
  guard();
  const decision = fd.get("decision");
  if (decision !== "approved" && decision !== "denied" && decision !== "pending") return;
  await applyDecision(String(fd.get("id")), decision, "admin");
  revalidatePath("/admin", "layout");
}

/** HR can correct the type of a single request directly (no owner approval needed). */
export async function changeLeaveType(fd: FormData) {
  guard();
  const id = String(fd.get("id")), type = String(fd.get("leave_type"));
  const sb = db();
  if (!(await getLeaveTypes(sb, true)).some((t) => t.code === type)) return;
  const { data: l } = await sb.from("leave_requests").select("employee_id,start_date,status").eq("id", id).maybeSingle();
  if (!l) return;
  await sb.from("leave_requests").update({ leave_type: type }).eq("id", id);
  // re-check the limit for the new type (this request is now counted in it)
  if (l.status !== "denied") {
    const q = (await quotaFor(l.employee_id, Number(String(l.start_date).slice(0, 4)), sb)).find((x) => x.code === type);
    await sb.from("leave_requests").update({ over_quota: !!q && q.limit !== null && q.used + q.pending > q.limit }).eq("id", id);
  }
  revalidatePath("/admin", "layout");
}

export async function addEmployee(fd: FormData) {
  guard();
  const name = String(fd.get("name") ?? "").replace(/\s+/g, " ").trim();
  const pin = String(fd.get("pin") ?? "");
  const dept = String(fd.get("dept") ?? "");
  if (!name || !validPin(pin)) redirect("/admin/employees?e=" + encodeURIComponent("กรอกชื่อและ PIN 3–6 หลัก"));
  const { error } = await db().from("employees").insert({
    name, pin_hash: hashPin(pin), dept: (DEPTS as readonly string[]).includes(dept) ? dept : null,
  });
  if (error) redirect("/admin/employees?e=" + encodeURIComponent("เพิ่มไม่ได้ (ชื่อซ้ำหรือไม่ถูกต้อง)"));
  revalidatePath("/admin/employees");
}

export async function resetPin(fd: FormData) {
  guard();
  const pin = String(fd.get("pin") ?? "");
  if (!validPin(pin)) redirect("/admin/employees?e=" + encodeURIComponent("PIN ต้องเป็นตัวเลข 3–6 หลัก"));
  const id = String(fd.get("id"));
  await db().from("employees").update({ pin_hash: hashPin(pin) }).eq("id", id);
  await db().from("login_attempts").delete().eq("employee_id", id);
  revalidatePath("/admin/employees");
}

export async function toggleActive(fd: FormData) {
  guard();
  const activate = fd.get("activate") === "1";
  await db().from("employees").update({ active: activate, ended_on: activate ? null : bkkDate() }).eq("id", String(fd.get("id")));
  revalidatePath("/admin", "layout");
}

export async function setEmail(fd: FormData) {
  guard();
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) redirect("/admin/employees?e=" + encodeURIComponent("รูปแบบอีเมลไม่ถูกต้อง"));
  await db().from("employees").update({ email: email || null }).eq("id", String(fd.get("id")));
  revalidatePath("/admin/employees");
}

export async function saveSettings(fd: FormData) {
  guard();
  const late = String(fd.get("late_from") ?? "");
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(late)) redirect("/admin/settings?e=" + encodeURIComponent("เวลาไม่ถูกต้อง"));
  const days = [1, 2, 3, 4, 5, 6, 7].filter((d) => fd.get(`d${d}`) === "on");
  const holidays = String(fd.get("holidays") ?? "").split(/[\s,]+/).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
  await db().from("settings").upsert([
    { key: "late_from", value: late }, { key: "work_days", value: days }, { key: "holidays", value: [...new Set(holidays)].sort() },
    { key: "hr_email", value: String(fd.get("hr_email") ?? "").trim() }, { key: "remind_enabled", value: fd.get("remind_enabled") === "on" },
  ]);
  revalidatePath("/admin", "layout");
  redirect("/admin/settings?ok=1");
}

/* ---------- leave policy (HR -> owner approval, owner -> direct) ---------- */
const LT = "/admin/leave-types";
const numOrNull = (v: FormDataEntryValue | null) => {
  const t = String(v ?? "").trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 && n <= 365 && (n * 2) % 1 === 0 ? n : NaN;
};

export async function saveLeaveType(fd: FormData) {
  guard();
  const role = getRole()!;
  const sb = db();
  const all = await getLeaveTypes(sb, true);
  const code = String(fd.get("code") ?? "").trim() || newTypeCode();
  const before = all.find((t) => t.code === code) ?? null;
  const name_th = String(fd.get("name_th") ?? "").trim().slice(0, 40);
  const annual_days = numOrNull(fd.get("annual_days"));
  if (!name_th) back(LT, "กรุณาใส่ชื่อประเภทการลา");
  if (Number.isNaN(annual_days)) back(LT, "จำนวนวันต้องเป็น 0–365 (เพิ่มทีละ 0.5) หรือเว้นว่าง = ไม่จำกัด");
  if (!before && all.some((t) => t.name_th === name_th)) back(LT, "มีประเภทการลาชื่อนี้แล้ว");
  const payload = {
    code, name_th, annual_days, allow_over: fd.get("allow_over") === "on", active: before ? fd.get("active") === "on" : true,
    sort: Number(fd.get("sort")) || (before?.sort ?? Math.max(0, ...all.map((t) => t.sort)) + 1), before,
  };
  const r = await submitChange("leave_type", payload, role, sb);
  if (!r.ok) back(LT, "บันทึกไม่สำเร็จ: " + r.error);
  revalidatePath("/admin", "layout");
  back(LT, r.applied ? "บันทึกแล้ว" : "ส่งให้เจ้าของอนุมัติแล้ว", "ok");
}

export async function saveEmployeeQuota(fd: FormData) {
  guard();
  const role = getRole()!;
  const sb = db();
  const employee_id = String(fd.get("employee_id") ?? ""), leave_type = String(fd.get("leave_type") ?? "");
  const annual_days = numOrNull(fd.get("annual_days"));
  if (Number.isNaN(annual_days)) back(LT, "จำนวนวันต้องเป็น 0–365 (เพิ่มทีละ 0.5) หรือเว้นว่าง = ใช้ค่าปกติ");
  const [{ data: emp }, types, { data: cur }] = await Promise.all([
    sb.from("employees").select("name").eq("id", employee_id).maybeSingle(),
    getLeaveTypes(sb, true),
    sb.from("employee_leave_quotas").select("annual_days").eq("employee_id", employee_id).eq("leave_type", leave_type).maybeSingle(),
  ]);
  const t = types.find((x) => x.code === leave_type);
  if (!emp || !t) back(LT, "เลือกพนักงานและประเภทการลา");
  const r = await submitChange("employee_quota", {
    employee_id, employee_name: emp!.name, leave_type, type_name: t!.name_th, annual_days,
    before: cur ? Number(cur.annual_days) : null,
  }, role, sb);
  if (!r.ok) back(LT, "บันทึกไม่สำเร็จ: " + r.error);
  revalidatePath("/admin", "layout");
  back(LT, r.applied ? "บันทึกแล้ว" : "ส่งให้เจ้าของอนุมัติแล้ว", "ok");
}

export async function decideChange(fd: FormData) {
  guard();
  if (!isOwner()) back("/admin/approvals", "เฉพาะเจ้าของเท่านั้นที่อนุมัติได้");
  const decision = fd.get("decision") === "approved" ? "approved" : "rejected";
  const r = await decideChangeLib(String(fd.get("id")), decision, "owner", String(fd.get("note") ?? "").trim() || null);
  revalidatePath("/admin", "layout");
  if (!r.ok) back("/admin/approvals", r.error);
  back("/admin/approvals", decision === "approved" ? "อนุมัติและใช้งานแล้ว" : "ไม่อนุมัติแล้ว", "ok");
}

/** Cancel an HR request that is still pending (HR or owner). */
export async function cancelChange(fd: FormData) {
  guard();
  await db().from("change_requests").update({ status: "rejected", decided_at: new Date().toISOString(), decided_by: getRole(), owner_note: "ยกเลิกโดยผู้ส่ง" })
    .eq("id", String(fd.get("id"))).eq("status", "pending");
  revalidatePath("/admin", "layout");
}
