// src/app/admin/(panel)/page.tsx
import Link from "next/link";
import { periodReport, resolveRange, todayBoard } from "@/lib/report";
import { hhmm, hrRows, hrSummary } from "@/lib/hr";
import { bkkDate, bkkTime, thDate, thMonth } from "@/lib/time";
import { DEPTS } from "@/lib/types";
import { getLeaveTypes } from "@/lib/quota";

const f1 = (n: number | null) => (n === null ? "-" : n.toFixed(1) + "%");
const WD = ["จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส.", "อา."];
const STATE: Record<string, [string, string]> = {
  in: ["เข้างานแล้ว", "bg-green-100 text-green-700"], late: ["เข้างานสาย", "bg-orange-100 text-orange-700"],
  out: ["ออกงานแล้ว", "bg-slate-100 text-slate-600"], leave: ["ลา", "bg-blue-100 text-blue-700"], none: ["ยังไม่ลงเวลา", "bg-red-50 text-red-600"],
};
const PRESETS: [string, string][] = [["this", "เดือนนี้"], ["last", "เดือนที่แล้ว"], ["90", "90 วัน"], ["ytd", "ปีนี้"]];

function Bar({ pct, color = "bg-indigo-500" }: { pct: number | null; color?: string }) {
  return <div className="h-2 w-full rounded-full bg-slate-100"><div className={`h-2 rounded-full ${color}`} style={{ width: `${Math.min(100, pct ?? 0)}%` }} /></div>;
}
function Kpi({ title, value, sub, tone = "" }: { title: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <p className="text-xs text-slate-500">{title}</p><p className={`text-2xl font-bold ${tone}`}>{value}</p>{sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

export default async function Overview({ searchParams: sp }: { searchParams: { p?: string; from?: string; to?: string; dept?: string; s?: string } }) {
  const range = resolveRange(sp);
  const [board, report, types] = await Promise.all([todayBoard(), periodReport(range.start, range.end), getLeaveTypes(undefined, true)]);
  const tName = (c: string) => types.find((x) => x.code === c)?.name_th ?? c;
  const all = hrRows(report);
  const missing = board.filter((b) => b.state === "none");
  const rows = all.filter((r) => !sp.dept || r.dept === sp.dept);
  const sum = hrSummary(rows);
  const t = sum.totals;
  const sorters: Record<string, (a: (typeof rows)[0], b: (typeof rows)[0]) => number> = {
    late: (a, b) => (b.latePct ?? -1) - (a.latePct ?? -1), ontime: (a, b) => (b.onTimePct ?? -1) - (a.onTimePct ?? -1),
    norecord: (a, b) => b.norecord - a.norecord, leave: (a, b) => b.leave_days - a.leave_days, name: (a, b) => a.name.localeCompare(b.name, "th"),
  };
  const sorted = [...rows].sort(sorters[sp.s ?? "name"] ?? sorters.name);
  const q = (extra: Record<string, string>) => "?" + new URLSearchParams({ ...(sp as Record<string, string>), ...extra }).toString();
  const ranked = rows.filter((r) => r.ok + r.late >= 5); // ignore tiny samples
  const top = (fn: (a: (typeof rows)[0], b: (typeof rows)[0]) => number, keep: (r: (typeof rows)[0]) => boolean) => [...ranked].filter(keep).sort(fn).slice(0, 5);
  const best = top(sorters.ontime, (r) => (r.onTimePct ?? 0) > 0);
  const worst = top(sorters.late, (r) => r.late > 0);
  const gaps = [...rows].sort(sorters.norecord).filter((r) => r.norecord > 0).slice(0, 5);
  const maxB = Math.max(1, ...sum.buckets.map((b) => b[1]));

  return (
    <div className="space-y-5">
      <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="font-bold">วันนี้ · {thDate(bkkDate())}</h2>
        <div className="flex flex-wrap gap-2">
          {(["in", "late", "out", "leave", "none"] as const).map((s) => (
            <span key={s} className={`rounded-full px-3 py-1 text-sm font-semibold ${STATE[s][1]}`}>{STATE[s][0]} {board.filter((b) => b.state === s).length}</span>
          ))}
        </div>
        {missing.length > 0 && <p className="text-sm text-red-600">ยังไม่ลงเวลา: {missing.map((m) => m.name).join(", ")}</p>}
        <details>
          <summary className="cursor-pointer text-sm text-indigo-700">ดูรายชื่อทั้งหมดวันนี้</summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="text-left text-xs text-slate-500"><tr><th className="py-1">ชื่อ</th><th>แผนก</th><th>เข้า</th><th>ออก</th><th>สถานะ</th></tr></thead>
              <tbody className="divide-y">
                {board.map((r) => (
                  <tr key={r.id}>
                    <td className="py-1.5 font-medium">{r.name}</td><td>{r.dept ?? "-"}</td>
                    <td className="font-mono">{r.first_in ? bkkTime(r.first_in) : "-"}</td>
                    <td className="font-mono">{r.last_out ? bkkTime(r.last_out) : "-"}</td>
                    <td><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATE[r.state][1]}`}>{STATE[r.state][0]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-2 text-lg font-bold">สถิติ · {range.label}</h1>
        {PRESETS.map(([k, l]) => (
          <Link key={k} href={q({ p: k, from: "", to: "" })} className={`rounded-lg px-3 py-1.5 text-sm ${range.p === k ? "bg-indigo-600 text-white" : "bg-white text-slate-600 shadow-sm"}`}>{l}</Link>
        ))}
        <a href={`/admin/export${q({})}`} className="ml-auto rounded-lg border bg-white px-3 py-1.5 text-sm">ดาวน์โหลด CSV</a>
      </div>
      <form className="flex flex-wrap items-center gap-2 text-sm">
        <input type="hidden" name="p" value="custom" />
        <input type="date" name="from" defaultValue={range.start} className="rounded-lg border px-2 py-1" /> –
        <input type="date" name="to" defaultValue={range.end} className="rounded-lg border px-2 py-1" />
        <select name="dept" defaultValue={sp.dept ?? ""} className="rounded-lg border px-2 py-1"><option value="">ทุกแผนก</option>{DEPTS.map((d) => <option key={d}>{d}</option>)}</select>
        <button className="rounded-lg bg-slate-800 px-3 py-1 text-white">ดูช่วงนี้</button>
      </form>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi title="ตรงเวลา" value={f1(sum.onTimePct)} sub={`${t.ok} จาก ${t.ok + t.late} วันที่เข้างาน`} tone="text-green-600" />
        <Kpi title="เข้างานสาย" value={f1(sum.latePct)} sub={`${t.late} วัน`} tone="text-orange-600" />
        <Kpi title="อัตราการมาทำงาน" value={f1(sum.attendPct)} sub="วันที่มี ÷ (มี + ไม่มีบันทึก) ไม่รวมวันลา" />
        <Kpi title="ไม่มีบันทึก" value={String(t.norecord)} sub="วันทำงานที่ไม่ลงเวลาและไม่ลา" tone={t.norecord ? "text-red-600" : ""} />
        <Kpi title="วันลา (อนุมัติแล้ว)" value={String(t.leave)} sub={Object.entries(sum.leaveBy).map(([k, v]) => `${tName(k)} ${v}`).join(" · ") || "-"} />
        <Kpi title="เวลาเข้างานเฉลี่ย" value={hhmm(sum.avgIn)} sub={`${sum.headcount} คน`} />
        <Kpi title="ชม.อยู่ที่ทำงานเฉลี่ย/วัน" value={sum.avgHours === null ? "-" : sum.avgHours.toFixed(1)} sub="จากเวลาเข้า → ออก" />
        <Kpi title="ลืมลงเวลา" value={`${t.partial} / ${t.missOut}`} sub="ไม่ลงเข้า / ไม่ลงออก" tone={t.partial + t.missOut ? "text-amber-600" : ""} />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {[["🏅 ตรงเวลาสม่ำเสมอ", best, (r: (typeof rows)[0]) => f1(r.onTimePct)], ["⏰ สายบ่อยที่สุด", worst, (r: (typeof rows)[0]) => `${r.late} วัน (${f1(r.latePct)})`], ["❓ ไม่มีบันทึกมากที่สุด", gaps, (r: (typeof rows)[0]) => `${r.norecord} วัน`]].map(([title, list, fmt]) => (
          <section key={title as string} className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold">{title as string}</h2>
            <ol className="space-y-1 text-sm">
              {(list as typeof rows).map((r) => <li key={r.id} className="flex justify-between"><span>{r.name}</span><span className="font-mono text-slate-500">{(fmt as (r: (typeof rows)[0]) => string)(r)}</span></li>)}
              {(list as typeof rows).length === 0 && <li className="text-slate-400">-</li>}
            </ol>
          </section>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="p-3"><Link href={q({ s: "name" })}>ชื่อ</Link></th><th>แผนก</th><th>มาทำงาน</th>
              <th className="w-44"><Link href={q({ s: "ontime" })}>ตรงเวลา %</Link> / <Link href={q({ s: "late" })}>สาย %</Link></th>
              <th><Link href={q({ s: "leave" })}>วันลา</Link></th><th><Link href={q({ s: "norecord" })}>ไม่มีบันทึก</Link></th>
              <th>เข้าเฉลี่ย</th><th>ชม.เฉลี่ย</th><th>สายติดกัน</th><th>ไม่ลงออก</th><th>นอกพื้นที่</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {sorted.map((r) => (
              <tr key={r.id}>
                <td className="p-3 font-medium"><Link className="text-indigo-700 underline" href={`/admin/report?emp=${r.id}&ym=${range.end.slice(0, 7)}`}>{r.name}</Link></td>
                <td>{r.dept ?? "-"}</td><td>{r.present}</td>
                <td>
                  <div className="flex justify-between text-xs"><span className="text-green-600">{r.ok} · {f1(r.onTimePct)}</span><span className="text-orange-600">{r.late} · {f1(r.latePct)}</span></div>
                  <div className="flex h-2 overflow-hidden rounded-full bg-slate-100"><div className="bg-green-500" style={{ width: `${r.onTimePct ?? 0}%` }} /><div className="bg-orange-400" style={{ width: `${r.latePct ?? 0}%` }} /></div>
                </td>
                <td title={Object.entries(r.leave_by).map(([k, v]) => `${tName(k)} ${v}`).join(", ")}>{r.leave_days}{r.leave_days > 0 && <span className="block text-[10px] text-slate-400">{Object.entries(r.leave_by).map(([k, v]) => `${tName(k)} ${v}`).join(" · ")}</span>}</td>
                <td className={r.norecord >= 3 ? "font-bold text-red-600" : ""}>{r.norecord}</td>
                <td className="font-mono">{hhmm(r.avgIn)}</td><td>{r.avgHours === null ? "-" : r.avgHours.toFixed(1)}</td>
                <td className={r.late_streak >= 3 ? "font-bold text-orange-600" : ""}>{r.late_streak || "-"}</td>
                <td>{r.missing_out || "-"}</td><td>{r.gps_issues || "-"}</td>
              </tr>
            ))}
            {sorted.length === 0 && <tr><td colSpan={11} className="p-4 text-slate-400">ไม่มีข้อมูลช่วงนี้</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">เข้างานกี่โมง (ทุกคน)</h2>
          <div className="space-y-1">
            {sum.buckets.map(([m, n]) => (
              <div key={m} className="flex items-center gap-2 text-xs"><span className="w-12 font-mono text-slate-500">{hhmm(m)}{m >= 630 ? "+" : ""}</span>
                <div className="h-3 flex-1 rounded bg-slate-100"><div className={`h-3 rounded ${hhmm(m) >= "09:15" ? "bg-orange-400" : "bg-green-500"}`} style={{ width: `${(n / maxB) * 100}%` }} /></div><span className="w-8 text-right">{n}</span></div>
            ))}
          </div>
        </section>
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">สายตามวันในสัปดาห์</h2>
          <div className="space-y-1">
            {sum.weekday.filter((w) => w.ok + w.late > 0).map((w) => (
              <div key={w.day} className="flex items-center gap-2 text-xs"><span className="w-8">{WD[w.day - 1]}</span>
                <Bar pct={w.latePct} color="bg-orange-400" /><span className="w-24 text-right">{f1(w.latePct)} ({w.late}/{w.ok + w.late})</span></div>
            ))}
          </div>
        </section>
        {sum.months.length > 1 && (
          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold">แนวโน้มตรงเวลา % รายเดือน</h2>
            <div className="space-y-1">
              {sum.months.map((m) => (
                <div key={m.month} className="flex items-center gap-2 text-xs"><span className="w-24">{thMonth(m.month)}</span>
                  <Bar pct={m.onTimePct} color="bg-green-500" /><span className="w-24 text-right">{f1(m.onTimePct)} · ไม่มีบันทึก {m.norecord}</span></div>
              ))}
            </div>
          </section>
        )}
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">แยกตามแผนก</h2>
          <table className="w-full text-xs"><thead className="text-left text-slate-500"><tr><th>แผนก</th><th>ตรงเวลา %</th><th>สาย</th><th>วันลา</th><th>ไม่มีบันทึก</th></tr></thead>
            <tbody className="divide-y">{sum.byDept.map((d) => <tr key={d.dept}><td className="py-1">{d.dept}</td><td>{f1(d.onTimePct)}</td><td>{d.late}</td><td>{d.leave}</td><td>{d.norecord}</td></tr>)}</tbody></table>
        </section>
      </div>
      <p className="text-xs text-slate-400">นิยาม: ตรงเวลา % = ตรงเวลา ÷ (ตรงเวลา + สาย) · สาย = ลงเวลาเข้างานครั้งแรกของวัน ≥ เวลาที่ตั้งไว้ · ไม่มีบันทึก = วันทำงานที่ไม่ลงเวลาและไม่มีใบลาอนุมัติ (ไม่นับวันหยุดที่ตั้งไว้) · อันดับนับเฉพาะคนที่มีวันเข้างาน ≥ 5 วัน</p>
    </div>
  );
}
