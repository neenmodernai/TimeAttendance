// src/lib/hr.ts  -- pure aggregation for the HR dashboard (no DB access)
import type { EmpSummary } from "./report";
import { isoWeekday } from "./time";

const pct = (a: number, b: number) => (b > 0 ? (a / b) * 100 : null);
export const hhmm = (min: number | null) => {
  if (min === null) return "-";
  const t = Math.round(min); // round total minutes first so 08:59.6 -> 09:00, never "08:60"
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};

export type HrRow = EmpSummary & {
  present: number; onTimePct: number | null; latePct: number | null; attendPct: number | null;
  avgIn: number | null; avgHours: number | null;
};

export function hrRows(rows: EmpSummary[]): HrRow[] {
  return rows.map((r) => {
    const present = r.ok + r.late + r.missing_in;
    return {
      ...r, present,
      onTimePct: pct(r.ok, r.ok + r.late),
      latePct: pct(r.late, r.ok + r.late),
      attendPct: pct(present, present + r.norecord),          // leave is excused, so left out of both sides
      avgIn: r.in_n ? r.in_min_sum / r.in_n : null,
      avgHours: r.hours_n ? r.hours_sum / r.hours_n : null,
    };
  });
}

export function hrSummary(rows: EmpSummary[]) {
  const t = rows.reduce((a, r) => ({
    ok: a.ok + r.ok, late: a.late + r.late, norecord: a.norecord + r.norecord, partial: a.partial + r.missing_in,
    leave: a.leave + r.leave_days, sick: a.sick + r.leave_sick, personal: a.personal + r.leave_personal, vacation: a.vacation + r.leave_vacation,
    gps: a.gps + r.gps_issues, missOut: a.missOut + r.missing_out,
    inSum: a.inSum + r.in_min_sum, inN: a.inN + r.in_n, hSum: a.hSum + r.hours_sum, hN: a.hN + r.hours_n,
  }), { ok: 0, late: 0, norecord: 0, partial: 0, leave: 0, sick: 0, personal: 0, vacation: 0, gps: 0, missOut: 0, inSum: 0, inN: 0, hSum: 0, hN: 0 });
  const present = t.ok + t.late + t.partial;

  // when do people arrive? (15-minute buckets, clamped to 07:30–10:30)
  const buckets = new Map<number, number>();
  const wd = Array.from({ length: 7 }, () => ({ ok: 0, late: 0 }));
  const months = new Map<string, { ok: number; late: number; norecord: number }>();
  for (const r of rows) for (const d of r.days) {
    if (d.in_min !== null) {
      const b = Math.min(Math.max(Math.floor(d.in_min / 15) * 15, 450), 630);
      buckets.set(b, (buckets.get(b) ?? 0) + 1);
    }
    const m = months.get(d.date.slice(0, 7)) ?? { ok: 0, late: 0, norecord: 0 };
    if (d.status === "ok") { wd[isoWeekday(d.date) - 1].ok++; m.ok++; }
    if (d.status === "late") { wd[isoWeekday(d.date) - 1].late++; m.late++; }
    if (d.status === "norecord") m.norecord++;
    months.set(d.date.slice(0, 7), m);
  }
  const byDept = new Map<string, { ok: number; late: number; leave: number; norecord: number }>();
  for (const r of rows) {
    const k = r.dept ?? "ไม่ระบุ", c = byDept.get(k) ?? { ok: 0, late: 0, leave: 0, norecord: 0 };
    c.ok += r.ok; c.late += r.late; c.leave += r.leave_days; c.norecord += r.norecord; byDept.set(k, c);
  }
  return {
    totals: t, headcount: rows.length,
    onTimePct: pct(t.ok, t.ok + t.late), latePct: pct(t.late, t.ok + t.late), attendPct: pct(present, present + t.norecord),
    avgIn: t.inN ? t.inSum / t.inN : null, avgHours: t.hN ? t.hSum / t.hN : null,
    buckets: [...buckets.entries()].sort((a, b) => a[0] - b[0]),
    weekday: wd.map((w, i) => ({ day: i + 1, ...w, latePct: pct(w.late, w.ok + w.late) })),
    months: [...months.entries()].sort().map(([m, v]) => ({ month: m, ...v, onTimePct: pct(v.ok, v.ok + v.late) })),
    byDept: [...byDept.entries()].map(([dept, v]) => ({ dept, ...v, onTimePct: pct(v.ok, v.ok + v.late) })),
  };
}
