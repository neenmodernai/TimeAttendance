// src/app/api/punch/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getEmployeeId } from "@/lib/session";
import { nearestSite, Site } from "@/lib/geo";
import { bkkTime } from "@/lib/time";

const KINDS = ["check_in", "check_out", "lunch_begin", "lunch_end"];
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

export async function POST(req: Request) {
  const id = getEmployeeId();
  if (!id) return NextResponse.json({ error: "กรุณาเข้าสู่ระบบใหม่" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  if (!KINDS.includes(b.kind)) return NextResponse.json({ error: "รายการไม่ถูกต้อง" }, { status: 400 });

  const lat = num(b.lat), lng = num(b.lng);
  const note = typeof b.note === "string" ? b.note.trim().slice(0, 300) : "";
  if ((lat === null || lng === null || Math.abs(lat) > 90 || Math.abs(lng) > 180) && !note) {
    return NextResponse.json({ error: "ไม่พบตำแหน่ง GPS กรุณาระบุเหตุผล", needNote: true }, { status: 400 });
  }
  const sb = db();

  // Ignore accidental double-taps / retries within 2 minutes
  const since = new Date(Date.now() - 120_000).toISOString();
  const { data: dup } = await sb.from("punches").select("id,punched_at").eq("employee_id", id)
    .eq("kind", b.kind).gte("punched_at", since).limit(1);
  if (dup?.length) return NextResponse.json({ ok: true, duplicate: true, time: bkkTime(dup[0].punched_at) });

  const { data: sites } = await sb.from("sites").select("id,name,lat,lng,radius_m").eq("active", true);
  let site_id: string | null = null, distance_m: number | null = null, gps_ok = false;
  if (lat !== null && lng !== null) {
    if (!sites?.length) gps_ok = true; // no site configured yet -> nothing to verify against
    else {
      const best = nearestSite(lat, lng, sites as Site[])!;
      site_id = best.site.id; distance_m = Math.round(best.dist); gps_ok = best.dist <= best.site.radius_m;
    }
  }
  const { data, error } = await sb.from("punches").insert({
    employee_id: id, kind: b.kind, lat, lng, accuracy_m: num(b.accuracy),
    site_id, distance_m, gps_ok, note: note || null, source: "app",
  }).select("punched_at").single();
  if (error) return NextResponse.json({ error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" }, { status: 500 });
  return NextResponse.json({ ok: true, time: bkkTime(data.punched_at), gps_ok, distance_m });
}
