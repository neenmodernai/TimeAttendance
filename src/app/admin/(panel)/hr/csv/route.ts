// src/app/admin/(panel)/hr/csv/route.ts
import { isAdmin } from "@/lib/session";
import { periodReport, resolveRange } from "@/lib/report";
import { hhmm, hrRows } from "@/lib/hr";

export const dynamic = "force-dynamic";
const q = (v: string | number | null) => `"${String(v ?? "").replace(/"/g, '""')}"`;
const p1 = (n: number | null) => (n === null ? "" : n.toFixed(1));

export async function GET(req: Request) {
  if (!isAdmin()) return new Response("unauthorized", { status: 401 });
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const r = resolveRange(sp);
  const rows = hrRows(await periodReport(r.start, r.end)).filter((x) => !sp.dept || x.dept === sp.dept);
  const head = ["ชื่อ-นามสกุล", "แผนก", "วันที่มาทำงาน", "ตรงเวลา", "ตรงเวลา %", "สาย", "สาย %", "อัตราเข้างาน %", "ลาป่วย", "ลากิจ", "ลาพักร้อน", "ไม่มีบันทึก", "เวลาเข้าเฉลี่ย", "ชม.ทำงานเฉลี่ย", "สายติดต่อกัน (วัน)", "ไม่ลงออกงาน", "ลงเวลานอกพื้นที่"];
  const lines = [head.map(q).join(",")].concat(rows.map((x) => [
    x.name, x.dept, x.present, x.ok, p1(x.onTimePct), x.late, p1(x.latePct), p1(x.attendPct), x.leave_sick, x.leave_personal, x.leave_vacation,
    x.norecord, hhmm(x.avgIn), x.avgHours === null ? "" : x.avgHours.toFixed(1), x.late_streak, x.missing_out, x.gps_issues,
  ].map(q).join(",")));
  return new Response("\uFEFF" + lines.join("\r\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="hr-${r.start}_${r.end}.csv"` },
  });
}
