// src/lib/quota.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { db } from "./db";

export type LeaveTypeRow = { code: string; name_th: string; annual_days: number | null; allow_over: boolean; active: boolean; sort: number };
export type QuotaRow = {
  code: string; name_th: string; allow_over: boolean;
  limit: number | null;      // null = no limit
  custom: boolean;           // limit comes from a per-employee override
  used: number;              // approved days this year
  pending: number;           // waiting for approval
  remaining: number | null;  // limit - used - pending (never below 0)
};

const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export async function getLeaveTypes(sb: SupabaseClient = db(), includeInactive = false): Promise<LeaveTypeRow[]> {
  let q = sb.from("leave_types").select("code,name_th,annual_days,allow_over,active,sort").order("sort").order("code");
  if (!includeInactive) q = q.eq("active", true);
  const { data } = await q;
  return (data ?? []).map((t) => ({ ...t, annual_days: n(t.annual_days) })) as LeaveTypeRow[];
}

export const typeName = (types: LeaveTypeRow[], code: string) => types.find((t) => t.code === code)?.name_th ?? code;

/** Pure: combine types, overrides and this year's requests into a balance per type. */
export function buildQuota(
  types: LeaveTypeRow[],
  overrides: { leave_type: string; annual_days: number }[],
  requests: { leave_type: string; days: number; status: string }[],
): QuotaRow[] {
  return types.filter((t) => t.active).map((t) => {
    const ov = overrides.find((o) => o.leave_type === t.code);
    const limit = ov ? Number(ov.annual_days) : t.annual_days;
    const mine = requests.filter((r) => r.leave_type === t.code);
    const sum = (s: string) => mine.filter((r) => r.status === s).reduce((a, r) => a + Number(r.days), 0);
    const used = sum("approved"), pending = sum("pending");
    return {
      code: t.code, name_th: t.name_th, allow_over: t.allow_over, limit, custom: !!ov, used, pending,
      remaining: limit === null ? null : Math.max(0, limit - used - pending),
    };
  });
}

/** Balance for one employee in a calendar year (leave counted by its start date). */
export async function quotaFor(employeeId: string, year: number, sb: SupabaseClient = db(), types?: LeaveTypeRow[]): Promise<QuotaRow[]> {
  const [t, ov, rq] = await Promise.all([
    types ? Promise.resolve(types) : getLeaveTypes(sb),
    sb.from("employee_leave_quotas").select("leave_type,annual_days").eq("employee_id", employeeId).then((r) => r.data ?? []),
    sb.from("leave_requests").select("leave_type,days,status").eq("employee_id", employeeId)
      .gte("start_date", `${year}-01-01`).lte("start_date", `${year}-12-31`).in("status", ["approved", "pending"]).then((r) => r.data ?? []),
  ]);
  return buildQuota(t, ov as { leave_type: string; annual_days: number }[], rq as { leave_type: string; days: number; status: string }[]);
}

/** Balances for every employee at once (HR overview). */
export async function quotaAll(year: number, sb: SupabaseClient = db()) {
  const [types, ov, rq] = await Promise.all([
    getLeaveTypes(sb),
    sb.from("employee_leave_quotas").select("employee_id,leave_type,annual_days").then((r) => r.data ?? []),
    sb.from("leave_requests").select("employee_id,leave_type,days,status")
      .gte("start_date", `${year}-01-01`).lte("start_date", `${year}-12-31`).in("status", ["approved", "pending"]).then((r) => r.data ?? []),
  ]);
  return {
    types,
    forEmployee: (id: string) => buildQuota(
      types,
      (ov as { employee_id: string; leave_type: string; annual_days: number }[]).filter((o) => o.employee_id === id),
      (rq as { employee_id: string; leave_type: string; days: number; status: string }[]).filter((r) => r.employee_id === id),
    ),
  };
}

export const fmtDays = (d: number | null) => (d === null ? "ไม่จำกัด" : Number.isInteger(d) ? String(d) : d.toFixed(1));
