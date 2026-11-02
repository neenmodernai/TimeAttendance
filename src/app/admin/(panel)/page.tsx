// src/app/admin/(panel)/page.tsx
import { todayBoard } from "@/lib/report";
import { bkkDate, bkkTime, thDate } from "@/lib/time";

const STATE: Record<string, [string, string]> = {
  in: ["เข้างานแล้ว", "bg-green-100 text-green-700"], late: ["เข้างานสาย", "bg-orange-100 text-orange-700"],
  out: ["ออกงานแล้ว", "bg-slate-100 text-slate-600"], leave: ["ลา", "bg-blue-100 text-blue-700"], none: ["ยังไม่ลงเวลา", "bg-red-50 text-red-600"],
};

export default async function Today() {
  const rows = await todayBoard();
  const count = (s: string) => rows.filter((r) => r.state === s).length;
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold">วันนี้ · {thDate(bkkDate())}</h1>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {(["in", "late", "out", "leave", "none"] as const).map((s) => (
          <div key={s} className="rounded-2xl bg-white p-3 text-center shadow-sm">
            <p className="text-2xl font-bold">{count(s)}</p><p className="text-xs text-slate-500">{STATE[s][0]}</p>
          </div>
        ))}
      </div>
      <table className="w-full overflow-hidden rounded-2xl bg-white text-sm shadow-sm">
        <thead className="bg-slate-50 text-left text-xs text-slate-500"><tr><th className="p-3">ชื่อ</th><th>แผนก</th><th>เข้า</th><th>ออก</th><th>สถานะ</th></tr></thead>
        <tbody className="divide-y">
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="p-3 font-medium">{r.name}</td><td>{r.dept ?? "-"}</td>
              <td className="font-mono">{r.first_in ? bkkTime(r.first_in) : "-"}</td>
              <td className="font-mono">{r.last_out ? bkkTime(r.last_out) : "-"}</td>
              <td><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATE[r.state][1]}`}>{STATE[r.state][0]}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
