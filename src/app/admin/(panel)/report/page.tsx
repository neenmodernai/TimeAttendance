// src/app/admin/(panel)/report/page.tsx
import { monthlyReport } from "@/lib/report";
import { bkkDate, bkkTime, thDate, thMonth } from "@/lib/time";

const DAY: Record<string, [string, string]> = {
  ok: ["ตรงเวลา", "text-green-700"], late: ["สาย", "text-orange-600"], partial: ["ไม่ลงเข้างาน", "text-amber-600"], norecord: ["ไม่มีบันทึก", "text-red-600"], leave: ["ลา", "text-blue-600"], off: ["", ""],
};

export default async function Report({ searchParams }: { searchParams: { ym?: string; emp?: string } }) {
  const ym = /^\d{4}-\d{2}$/.test(searchParams.ym ?? "") ? searchParams.ym! : bkkDate().slice(0, 7);
  const rows = await monthlyReport(ym);
  const sel = rows.find((r) => r.id === searchParams.emp);
  return (
    <div className="space-y-4">
      <form className="flex flex-wrap items-center gap-2">
        <h1 className="mr-2 text-lg font-bold">รายงาน {thMonth(ym)}</h1>
        <input type="month" name="ym" defaultValue={ym} className="rounded-lg border px-3 py-1.5 text-sm" />
        <button className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-white">ดู</button>
        <a href={`/admin/report/csv?ym=${ym}`} className="ml-auto rounded-lg border px-3 py-1.5 text-sm">ดาวน์โหลด CSV (Excel)</a>
      </form>
      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr><th className="p-3">ชื่อ</th><th>แผนก</th><th>ตรงเวลา</th><th>สาย</th><th>ไม่มีบันทึก</th><th>วันลา</th><th>ไม่ลงเข้า</th><th>ไม่ลงออก</th><th>นอกพื้นที่</th></tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.id} className={r.id === sel?.id ? "bg-indigo-50" : ""}>
                <td className="p-3"><a className="font-medium text-indigo-700 underline" href={`?ym=${ym}&emp=${r.id}`}>{r.name}</a></td>
                <td>{r.dept ?? "-"}</td><td>{r.ok}</td><td>{r.late}</td><td>{r.norecord}</td><td>{r.leave_days}</td><td>{r.missing_in}</td><td>{r.missing_out}</td><td>{r.gps_issues}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td className="p-4 text-slate-400" colSpan={9}>ไม่มีข้อมูลเดือนนี้</td></tr>}
          </tbody>
        </table>
      </div>
      {sel && (
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-2 font-bold">{sel.name} · รายวัน</h2>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-500"><tr><th className="py-1">วันที่</th><th>เข้า</th><th>ออก</th><th>สถานะ</th><th>หมายเหตุ</th></tr></thead>
            <tbody className="divide-y">
              {sel.days.map((d) => (
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
      )}
    </div>
  );
}
