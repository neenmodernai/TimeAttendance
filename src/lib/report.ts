// src/lib/report.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { db, getSettings } from "./db";
import { addDays, bkkDate, bkkTime, isoWeekday, monthBounds } from "./time";

export type DayStatus = "ok" | "late" | "partial" | "norecord" | "leave" | "off";
export type DayRow = {
  date: string; first_in: string | null; last_out: string | null; status: DayStatus;
  gps_issues: number; missing_out: boolean; hours: number | null; in_min: number | null;
};
export type EmpSummary = {
  id: string; name: string; dept: string | null;
  ok: number; late: number; norecord: number; leave_days: number;
  leave_sick: number; leave_personal: number; leave_vacation: number;
  gps_issues: number; missing_in: number; missing_out: number;
  hours_sum: number; hours_n: number; in_min_sum: number; in_n: number; late_streak: number;
  days: DayRow[];
};

/** Supabase returns max 1000 rows per request - page through. */
async function fetchAll<T>(make: (from: number, to: number) => PromiseLike<{ data: T[] | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await make(from, from + 999);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

const ymd = /^\d{4}-\d{2}-\d{2}$/;
/** Date range for dashboards: ?p=this|last|90|ytd|custom&from=&to= */
export function resolveRange(sp: { p?: string; from?: string; to?: string }) {
  const today = bkkDate(), monthStart = today.slice(0, 7) + "-01";
  if (sp.p === "custom" && ymd.test(sp.from ?? "") && ymd.test(sp.to ?? "")) {
    let [s, e] = [sp.from!, sp.to!]; if (s > e) [s, e] = [e, s];
    if (e > today) e = today;
    if (s < addDays(e, -400)) s = addDays(e, -400);
    return { p: "custom", start: s, end: e, label: `${s} – ${e}` };
  }
  if (sp.p === "last") {
    const prev = addDays(monthStart, -1).slice(0, 7), b = monthBounds(prev);
    return { p: "last", start: b.start, end: b.end, label: "เดือนที่แล้ว" };
  }
  if (sp.p === "90") return { p: "90", start: addDays(today, -89), end: today, label: "90 วันล่าสุด" };
  if (sp.p === "ytd") return { p: "ytd", start: today.slice(0, 4) + "-01-01", end: today, label: "ปีนี้" };
  return { p: "this", start: monthStart, end: today, label: "เดือนนี้" };
}

export async function periodReport(start: string, end: string, sb: SupabaseClient = db()): Promise<EmpSummary[]> {
  const today = bkkDate();
  const settings = await getSettings(sb);
  const [emps, punches, leaves] = await Promise.all([
    sb.from("employees").select("id,name,dept,started_on,ended_on").then((r) => r.data ?? []),
    fetchAll<{ employee_id: string; kind: string; punched_at: string; work_date: string; gps_ok: boolean }>((a, b) =>
      sb.from("punches").select("employee_id,kind,punched_at,work_date,gps_ok")
        .gte("work_date", start).lte("work_date", end).order("punched_at").range(a, b)),
    sb.from("leave_requests").select("employee_id,start_date,days,leave_type").eq("status", "approved")
      .lte("start_date", end).gte("start_date", addDays(start, -45)).then((r) => r.data ?? []),
  ]);

  const isWork = (d: string) => settings.workDays.includes(isoWeekday(d)) && !settings.holidays.includes(d);
  // approved leave -> fraction of a working day per date (and its type)
  const leaveMap = new Map<string, { frac: number; type: string }>();
  for (const l of leaves) {
    let left = Number(l.days), d = l.start_date;
    for (let i = 0; i < 120 && left > 0; i++, d = addDays(d, 1)) {
      if (!isWork(d)) continue;
      const take = Math.min(1, left), k = `${l.employee_id}|${d}`, cur = leaveMap.get(k);
      leaveMap.set(k, { frac: (cur?.frac ?? 0) + take, type: cur?.type ?? l.leave_type });
      left -= take;
    }
  }
  const byEmpDate = new Map<string, typeof punches>();
  for (const p of punches) {
    const k = `${p.employee_id}|${p.work_date}`;
    byEmpDate.set(k, [...(byEmpDate.get(k) ?? []), p]);
  }
  const dates: string[] = [];
  for (let d = start; d <= end && d <= today; d = addDays(d, 1)) dates.push(d);

  const rows: EmpSummary[] = [];
  for (const e of emps) {
    const s: EmpSummary = {
      id: e.id, name: e.name, dept: e.dept, ok: 0, late: 0, norecord: 0, leave_days: 0, leave_sick: 0, leave_personal: 0, leave_vacation: 0,
      gps_issues: 0, missing_in: 0, missing_out: 0, hours_sum: 0, hours_n: 0, in_min_sum: 0, in_n: 0, late_streak: 0, days: [],
    };
    for (const date of dates) {
      const ps = byEmpDate.get(`${e.id}|${date}`) ?? [];
      const inScope = e.started_on <= date && (!e.ended_on || date <= e.ended_on);
      const lv = leaveMap.get(`${e.id}|${date}`);
      const fin = ps.find((p) => p.kind === "check_in");
      const fout = [...ps].reverse().find((p) => p.kind === "check_out");
      let status: DayStatus = "off";
      if (ps.length) status = !fin ? "partial" : bkkTime(fin.punched_at) >= settings.lateFrom ? "late" : "ok";
      else if (lv && inScope) status = "leave";
      else if (inScope && isWork(date) && date < today) status = "norecord";
      if (lv && inScope) {
        s.leave_days += lv.frac;
        if (lv.type === "sick") s.leave_sick += lv.frac; else if (lv.type === "personal") s.leave_personal += lv.frac; else s.leave_vacation += lv.frac;
      }
      if (status === "off") continue;
      const gps = ps.filter((p) => !p.gps_ok).length;
      const missing = !!fin && !fout && date < today;
      let hours: number | null = null, in_min: number | null = null;
      if (fin) {
        const [h, m] = bkkTime(fin.punched_at).split(":").map(Number);
        in_min = h * 60 + m; s.in_min_sum += in_min; s.in_n++;
        if (fout) {
          const hh = (+new Date(fout.punched_at) - +new Date(fin.punched_at)) / 3.6e6;
          if (hh > 0 && hh < 16) { hours = hh; s.hours_sum += hh; s.hours_n++; }
        }
      }
      if (status === "ok") s.ok++; else if (status === "late") s.late++; else if (status === "norecord") s.norecord++; else if (status === "partial") s.missing_in++;
      s.gps_issues += gps; s.missing_out += missing ? 1 : 0;
      s.days.push({ date, first_in: fin?.punched_at ?? null, last_out: fout?.punched_at ?? null, status, gps_issues: gps, missing_out: missing, hours, in_min });
    }
    for (let i = s.days.length - 1; i >= 0; i--) {
      const st = s.days[i].status;
      if (st === "late") s.late_streak++; else if (st === "leave") continue; else break;
    }
    if (s.ok + s.late + s.norecord + s.missing_in + s.leave_days > 0) rows.push(s);
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name, "th"));
}

export function monthlyReport(ym: string, sb: SupabaseClient = db()) {
  const { start, end } = monthBounds(ym);
  return periodReport(start, end, sb);
}

export type BoardRow = {
  id: string; name: string; dept: string | null; email: string | null;
  state: "in" | "late" | "out" | "leave" | "none"; first_in: string | null; last_out: string | null;
};

export async function todayBoard(sb: SupabaseClient = db()): Promise<BoardRow[]> {
  const today = bkkDate();
  const settings = await getSettings(sb);
  const [emps, ps, lv] = await Promise.all([
    sb.from("employees").select("id,name,dept,email").eq("active", true).then((r) => r.data ?? []),
    sb.from("punches").select("employee_id,kind,punched_at").eq("work_date", today).order("punched_at").then((r) => r.data ?? []),
    sb.from("leave_requests").select("employee_id,start_date,days").eq("status", "approved")
      .lte("start_date", today).gte("start_date", addDays(today, -30)).then((r) => r.data ?? []),
  ]);
  const onLeave = new Set<string>();
  for (const l of lv) {
    let left = Number(l.days), d = l.start_date;
    for (let i = 0; i < 60 && left > 0; i++, d = addDays(d, 1)) {
      if (!settings.workDays.includes(isoWeekday(d)) || settings.holidays.includes(d)) continue;
      if (d === today) onLeave.add(l.employee_id);
      left -= 1;
    }
  }
  return emps.map((e) => {
    const mine = ps.filter((p) => p.employee_id === e.id);
    const fin = mine.find((p) => p.kind === "check_in");
    const fout = [...mine].reverse().find((p) => p.kind === "check_out");
    const state: BoardRow["state"] = fout ? "out" : fin ? (bkkTime(fin.punched_at) >= settings.lateFrom ? "late" : "in")
      : onLeave.has(e.id) ? "leave" : "none";
    return { id: e.id, name: e.name, dept: e.dept, email: e.email, state, first_in: fin?.punched_at ?? null, last_out: fout?.punched_at ?? null };
  }).sort((a, b) => a.name.localeCompare(b.name, "th"));
}
