// src/app/admin/(panel)/report/page.tsx
import Link from "next/link";
import { db } from "@/lib/db";
import { hhmm, hrRows } from "@/lib/hr";
import { monthlyReport } from "@/lib/report";
import { addDays, bkkDate, bkkTime, monthBounds, thDate, thMonth } from "@/lib/time";
import { LeaveType, STATUS_TH, LeaveStatus } from "@/lib/types";
import { fmtDays, getLeaveTypes, quotaFor } from "@/lib/quota";

const DAY: Record<string, [string, string]> = {
  ok: ["ตรงเวลา", "text-green-700"], late: ["สาย", "text-orange-600"], partial: ["ไม่ลงเข้างาน", "text-amber-600"],
  norecord: ["ไม่มีบันทึก", "text-red-600"], leave: ["ลา", "text-blue-600"], off: ["", ""],
};
const f1 = (n: number | null) => (n === null ? "-" : n.toFixed(1) + "%");
const shiftMonth = (ym: string, n: number) => addDays(`${ym}-15`, n * 30).slice(0, 7);

function Stat({ label, value, tone = "" }: { label: string; value: string | number; tone?: string }) {
  return <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">{label}</p><p className={`text-xl font-bold ${tone}`}>{value}</p></div>;
}

export default async function Person({ searchParams }: { searchParams: { ym?: string; emp?: string } }) {
  const ym = /^\d{4}-\d{2}$/.test(searchParams.ym ?? "") ? searchParams.ym! : bkkDate().slice(0, 7);
  const { data: emps } = await db().from("employees").select("id,name,active").order("name");
  const list = (emps ?? []).sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, "th"));
  const empId = searchParams.emp ?? list.find((e) => e.active)?.id;
  const { start, end } = monthBounds(ym);
  const year = Number(ym.slice(0, 4));
  const allTypes = await getLeaveTypes(undefined, true);
  const [rows, leaves, quota] = await Promise.all([
    monthlyReport(ym),
    empId ? db().from("leave_requests").select("id,leave_type,start_date,days,reason,status")
      .eq("employee_id", empId).gte("start_date", start).lte("start_date", end).order("start_date")
      .then((r) => (r.data ?? []) as { id: string; leave_type: LeaveType; start_date: string; days: number; reason: string | null; status: LeaveStatus }[]) : [],
    empId ? quotaFor(empId, year, undefined, allTypes) : [],
  ]);
  const p = hrRows(rows).find((r) => r.id === empId);
  const link = (e: string | undefined, m: string) => `?emp=${e ?? ""}&ym=${m}`;

  return (
    <div className="space-y-4">
      <form className="flex flex-wrap items-center gap-2 rounded-2xl bg-white p-3 shadow-sm">
        <select name="emp" defaultValue={empId} className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm">
          {list.map((e) => <option key={e.id} value={e.id}>{e.name}{e.active ? "" : " (ปิดใช้งาน)"}</option>)}
        </select>
        <div className="flex items-center gap-1">
          <Link href={link(empId, shiftMonth(ym, -1))} className="rounded-lg border px-2 py-2 text-sm">‹</Link>
          <input type="month" name="ym" defaultValue={ym} className="rounded-lg border px-2 py-1.5 text-sm" />
          <Link href={link(empId, shiftMonth(ym, 1))} className="rounded-lg border px-2 py-2 text-sm">›</Link>
        </div>
        <button className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-white">ดู</button>
      </form>

      <h1 className="text-lg font-bold">{list.find((e) => e.id === empId)?.name ?? "-"} · {thMonth(ym)}</h1>
      {!p && <p className="rounded-2xl bg-white p-4 text-sm text-slate-400 shadow-sm">ไม่มีข้อมูลการลงเวลาในเดือนนี้</p>}
      {p && (
        <>
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-white p-3 shadow-sm sm:grid-cols-4">
            <Stat label="ตรงเวลา" value={`${p.ok} (${f1(p.onTimePct)})`} tone="text-green-600" />
            <Stat label="สาย" value={`${p.late} (${f1(p.latePct)})`} tone="text-orange-600" />
            <Stat label="วันลา" value={p.leave_days} />
            <Stat label="ไม่มีบันทึก" value={p.norecord} tone={p.norecord ? "text-red-600" : ""} />
            <Stat label="เวลาเข้าเฉลี่ย" value={hhmm(p.avgIn)} />
            <Stat label="ชม.เฉลี่ย/วัน" value={p.avgHours === null ? "-" : p.avgHours.toFixed(1)} />
            <Stat label="ไม่ลงเข้า / ไม่ลงออก" value={`${p.missing_in} / ${p.missing_out}`} />
            <Stat label="ลงเวลานอกพื้นที่" value={p.gps_issues} />
          </div>
          <section className="overflow-x-auto rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="mb-2 font-semibold">รายวัน</h2>
            <table className="w-full min-w-[480px] text-sm">
              <thead className="text-left text-xs text-slate-500"><tr><th className="py-1">วันที่</th><th>เข้า</th><th>ออก</th><th>สถานะ</th><th>หมายเหตุ</th></tr></thead>
              <tbody className="divide-y">
                {p.days.map((d) => (
                  <tr key={d.date}>
                    <td className="py-1.5">{thDate(d.date)}</td>
                    <td className="font-mono">{d.first_in ? bkkTime(d.first_in) : "-"}</td>
                    <td className="font-mono">{d.last_out ? bkkTime(d.last_out) : "-"}</td>
                    <td className={`font-semibold ${DAY[d.status][1]}`}>{DAY[d.status][0]}</td>
                    <td className="text-xs text-slate-400">{[d.gps_issues ? `นอกพื้นที่ ${d.gps_issues}` : "", d.missing_out ? "ไม่ลงออกงาน" : ""].filter(Boolean).join(" · ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
      {quota.length > 0 && (
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-2 font-semibold">สิทธิ์การลาปี {year + 543}</h2>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-500"><tr><th className="py-1">ประเภท</th><th>สิทธิ์</th><th>ใช้แล้ว</th><th>รออนุมัติ</th><th>คงเหลือ</th></tr></thead>
            <tbody className="divide-y">
              {quota.map((q) => (
                <tr key={q.code}>
                  <td className="py-1.5">{q.name_th}</td>
                  <td>{fmtDays(q.limit)}{q.custom && <span className="ml-1 text-[10px] text-indigo-600">(เฉพาะคน)</span>}</td>
                  <td>{fmtDays(q.used)}</td><td>{fmtDays(q.pending)}</td>
                  <td className={q.remaining === 0 ? "font-bold text-orange-600" : ""}>{fmtDays(q.remaining)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-2 font-semibold">ใบลาเดือนนี้</h2>
        {leaves.length === 0 && <p className="text-sm text-slate-400">ไม่มี</p>}
        <ul className="divide-y text-sm">
          {leaves.map((l) => (
            <li key={l.id} className="flex flex-wrap justify-between gap-2 py-2">
              <span>{thDate(l.start_date)} · {allTypes.find((t) => t.code === l.leave_type)?.name_th ?? l.leave_type} {l.days} วัน <span className="text-slate-400">{l.reason}</span></span>
              <span className="font-semibold">{STATUS_TH[l.status]}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
