// src/app/admin/(panel)/report/csv/route.ts
import { isAdmin } from "@/lib/session";
import { monthlyReport } from "@/lib/report";
import { bkkDate } from "@/lib/time";

export const dynamic = "force-dynamic";
const q = (v: string | number | null) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export async function GET(req: Request) {
  if (!isAdmin()) return new Response("unauthorized", { status: 401 });
  const p = new URL(req.url).searchParams.get("ym") ?? "";
  const ym = /^\d{4}-\d{2}$/.test(p) ? p : bkkDate().slice(0, 7);
  const rows = await monthlyReport(ym);
  const head = ["ชื่อ-นามสกุล", "แผนก", "ตรงเวลา", "สาย", "ไม่มีบันทึก", "วันลา (อนุมัติ)", "ไม่ลงเข้างาน", "ไม่ลงออกงาน", "GPS นอกพื้นที่"];
  const lines = [head.map(q).join(",")].concat(
    rows.map((r) => [r.name, r.dept, r.ok, r.late, r.norecord, r.leave_days, r.missing_in, r.missing_out, r.gps_issues].map(q).join(",")));
  return new Response("\uFEFF" + lines.join("\r\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="attendance-${ym}.csv"` },
  });
}
