// src/app/admin/(panel)/leaves/page.tsx
import { db } from "@/lib/db";
import { thDate } from "@/lib/time";
import { STATUS_TH, LeaveStatus } from "@/lib/types";
import { fmtDays, getLeaveTypes, quotaAll, QuotaRow } from "@/lib/quota";
import { changeLeaveType, decideLeave } from "../../actions";

type Row = {
  id: string; employee_id: string; leave_type: string; over_quota: boolean; start_date: string; days: number;
  reason: string | null; contact: string | null; status: LeaveStatus; dept: string | null; employees: { name: string } | null;
};

function Balance({ q }: { q?: QuotaRow }) {
  if (!q) return null;
  if (q.limit === null) return <span className="text-xs text-slate-400">ไม่จำกัด · ใช้ไป {fmtDays(q.used)}</span>;
  const tight = q.remaining === 0;
  return (
    <span className={`text-xs ${tight ? "font-semibold text-orange-600" : "text-slate-500"}`}>
      สิทธิ์ปีนี้: ใช้ {fmtDays(q.used)} + รอ {fmtDays(q.pending)} / {fmtDays(q.limit)} · เหลือ {fmtDays(q.remaining)}
    </span>
  );
}

export default async function Leaves() {
  const sel = "id,employee_id,leave_type,over_quota,start_date,days,reason,contact,status,dept,employees(name)";
  const [pending, done, allTypes] = await Promise.all([
    db().from("leave_requests").select(sel).eq("status", "pending").order("start_date", { ascending: false }).limit(200),
    db().from("leave_requests").select(sel).neq("status", "pending").order("start_date", { ascending: false }).limit(30),
    getLeaveTypes(db(), true),
  ]);
  const p = (pending.data ?? []) as unknown as Row[], d = (done.data ?? []) as unknown as Row[];
  // balances for every year that appears in the list (usually just this year)
  const years = [...new Set([...p, ...d].map((r) => Number(r.start_date.slice(0, 4))))];
  const byYear = new Map(await Promise.all(years.map(async (y) => [y, await quotaAll(y)] as const)));
  const bal = (r: Row) => byYear.get(Number(r.start_date.slice(0, 4)))?.forEmployee(r.employee_id).find((q) => q.code === r.leave_type);
  const name = (code: string) => allTypes.find((t) => t.code === code)?.name_th ?? code;
  const active = allTypes.filter((t) => t.active);

  const Card = ({ r, isPending }: { r: Row; isPending: boolean }) => (
    <li className={`rounded-2xl bg-white p-4 shadow-sm ${r.over_quota ? "ring-2 ring-orange-300" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">{r.employees?.name} <span className="text-xs font-normal text-slate-400">{r.dept}</span></p>
        <span className="text-sm text-slate-500">
          {r.over_quota && <span className="mr-2 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700">เกินสิทธิ์</span>}
          {name(r.leave_type)} · {r.days} วัน · เริ่ม {thDate(r.start_date)}
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-600">{r.reason}</p>
      <div className="flex flex-wrap justify-between gap-2">
        <p className="text-xs text-slate-400">ติดต่อ: {r.contact ?? "-"}</p>
        <Balance q={bal(r)} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <form action={decideLeave} className="flex items-center gap-2">
          <input type="hidden" name="id" value={r.id} />
          {isPending ? (
            <>
              <button name="decision" value="approved" className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white">อนุมัติ</button>
              <button name="decision" value="denied" className="rounded-lg bg-red-100 px-4 py-2 text-sm font-semibold text-red-600">ไม่อนุมัติ</button>
            </>
          ) : (
            <>
              <span className="text-sm font-semibold">{STATUS_TH[r.status]}</span>
              <button name="decision" value="pending" className="text-xs text-slate-400 underline">ย้อนกลับเป็นรออนุมัติ</button>
            </>
          )}
        </form>
        <form action={changeLeaveType} className="ml-auto flex items-center gap-1">
          <input type="hidden" name="id" value={r.id} />
          <select name="leave_type" defaultValue={r.leave_type} className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs">
            {active.map((t) => <option key={t.code} value={t.code}>{t.name_th}</option>)}
            {!active.some((t) => t.code === r.leave_type) && <option value={r.leave_type}>{name(r.leave_type)} (ปิดใช้)</option>}
          </select>
          <button className="rounded-lg border px-2 py-1.5 text-xs">เปลี่ยนประเภท</button>
        </form>
      </div>
    </li>
  );

  return (
    <div className="space-y-6">
      <section>
        <h1 className="mb-2 text-lg font-bold">รออนุมัติ ({p.length})</h1>
        {p.length === 0 && <p className="text-sm text-slate-400">ไม่มีใบลาค้าง</p>}
        <ul className="space-y-2">{p.map((r) => <Card key={r.id} r={r} isPending />)}</ul>
      </section>
      <section>
        <h2 className="mb-2 font-bold">ตัดสินแล้ว (30 รายการล่าสุด)</h2>
        <ul className="space-y-2">{d.map((r) => <Card key={r.id} r={r} isPending={false} />)}</ul>
      </section>
    </div>
  );
}
