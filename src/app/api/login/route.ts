// src/app/api/login/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validPin, verifyPin } from "@/lib/pin";
import { setSession } from "@/lib/session";

const MAX_FAILS = 5, WINDOW_MIN = 10;

export async function POST(req: Request) {
  const { employeeId, pin, remember } = await req.json().catch(() => ({}));
  if (typeof employeeId !== "string" || !validPin(pin)) {
    return NextResponse.json({ error: "กรุณาเลือกชื่อและกรอก PIN ให้ถูกต้อง" }, { status: 400 });
  }
  const sb = db();
  const since = new Date(Date.now() - WINDOW_MIN * 60_000).toISOString();
  const { count } = await sb.from("login_attempts").select("id", { count: "exact", head: true })
    .eq("employee_id", employeeId).eq("ok", false).gte("attempted_at", since);
  if ((count ?? 0) >= MAX_FAILS) {
    return NextResponse.json({ error: `ใส่ PIN ผิดหลายครั้ง กรุณารอ ${WINDOW_MIN} นาที หรือแจ้งผู้ดูแลให้รีเซ็ต` }, { status: 429 });
  }
  const { data: emp } = await sb.from("employees").select("id,name,pin_hash,active").eq("id", employeeId).maybeSingle();
  const ok = !!emp && emp.active && verifyPin(pin, emp.pin_hash);
  if (emp) await sb.from("login_attempts").insert({ employee_id: emp.id, ok });
  if (!ok || !emp) return NextResponse.json({ error: "PIN ไม่ถูกต้อง" }, { status: 401 });

  await sb.from("login_attempts").delete().eq("employee_id", emp.id).eq("ok", false);
  setSession("emp", emp.id, remember ? 30 : 0);
  return NextResponse.json({ ok: true, name: emp.name });
}
