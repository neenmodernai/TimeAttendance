// src/app/api/me/route.ts
import { NextResponse } from "next/server";
import { db, getSettings } from "@/lib/db";
import { getEmployeeId } from "@/lib/session";
import { addDays, bkkDate, isoWeekday } from "@/lib/time";

export const dynamic = "force-dynamic";

export async function GET() {
  const id = getEmployeeId();
  if (!id) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = db();
  const today = bkkDate();
  const [emp, punches, leaves, settings] = await Promise.all([
    sb.from("employees").select("id,name,dept,contact,email,active").eq("id", id).maybeSingle(),
    sb.from("punches").select("kind,punched_at,work_date,gps_ok").eq("employee_id", id)
      .gte("work_date", addDays(today, -13)).order("punched_at"),
    sb.from("leave_requests").select("id,leave_type,start_date,days,reason,status,requested_at")
      .eq("employee_id", id).order("requested_at", { ascending: false }).limit(15),
    getSettings(),
  ]);
  if (!emp.data?.active) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({
    employee: emp.data, today, lateFrom: settings.lateFrom,
    isWorkday: settings.workDays.includes(isoWeekday(today)) && !settings.holidays.includes(today),
    punches: punches.data ?? [], leaves: leaves.data ?? [],
  });
}
