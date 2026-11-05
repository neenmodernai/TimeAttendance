// src/app/api/leave/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getEmployeeId } from "@/lib/session";
import { addDays, bkkDate } from "@/lib/time";
import { DEPTS } from "@/lib/types";
import { notifyHr } from "@/lib/leave";
import { fmtDays, getLeaveTypes, quotaFor } from "@/lib/quota";

export async function POST(req: Request) {
  const id = getEmployeeId();
  if (!id) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบใหม่" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const today = bkkDate();
  const bad = (error: string) => NextResponse.json({ error }, { status: 400 });

  if (typeof b.start_date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(b.start_date)
      || b.start_date < addDays(today, -60) || b.start_date > addDays(today, 365)) return bad("วันที่เริ่มลาไม่ถูกต้อง");
  const days = Number(b.days);
  if (!(days >= 0.5 && days <= 30) || (days * 2) % 1 !== 0) return bad("จำนวนวันต้องเป็น 0.5 – 30 (เพิ่มทีละ 0.5)");
  const reason = String(b.reason ?? "").trim().slice(0, 500);
  const contact = String(b.contact ?? "").trim().slice(0, 60);
  const email = String(b.email ?? "").trim().toLowerCase().slice(0, 120);
  if (!reason) return bad("กรุณาระบุเหตุผลการลา");
  if (!contact) return bad("กรุณาระบุเบอร์โทร / Line");
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return bad("รูปแบบอีเมลไม่ถูกต้อง");
  const dept = (DEPTS as readonly string[]).includes(b.dept) ? b.dept : null;

  const sb = db();
  const types = await getLeaveTypes(sb);
  if (!types.some((t) => t.code === b.leave_type)) return bad("กรุณาเลือกประเภทการลา");

  // Yearly limit (calendar year of the start date). Pending requests count against it too.
  const q = (await quotaFor(id, Number(b.start_date.slice(0, 4)), sb, types)).find((r) => r.code === b.leave_type)!;
  const over = q.limit !== null && q.used + q.pending + days > q.limit;
  if (over && !q.allow_over) {
    return bad(`${q.name_th} ปี ${b.start_date.slice(0, 4)} เหลือ ${fmtDays(q.remaining)} วัน (ใช้ ${fmtDays(q.used)} + รออนุมัติ ${fmtDays(q.pending)} จาก ${fmtDays(q.limit)}) — ติดต่อ HR หากต้องการลาเพิ่ม`);
  }

  const { data: created, error } = await sb.from("leave_requests").insert({
    employee_id: id, dept, leave_type: b.leave_type, start_date: b.start_date, days,
    contact, email: email || null, reason, source: "app", over_quota: over,
  }).select("id").single();
  if (error) return NextResponse.json({ error: "ส่งใบลาไม่สำเร็จ ลองใหม่อีกครั้ง" }, { status: 500 });
  // remember for next time so the form is pre-filled
  await sb.from("employees").update({ contact, email: email || null, ...(dept ? { dept } : {}) }).eq("id", id);
  let emailed = false;
  try { emailed = await notifyHr(created.id); } catch (e) { console.error("notifyHr", e); }
  return NextResponse.json({ ok: true, emailed, over_quota: over });
}
