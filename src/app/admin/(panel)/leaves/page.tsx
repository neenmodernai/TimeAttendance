// src/app/admin/(panel)/leaves/page.tsx
import { db } from "@/lib/db";
import { thDate } from "@/lib/time";
import { LEAVE_TH, LeaveType, STATUS_TH, LeaveStatus } from "@/lib/types";
import { decideLeave } from "../../actions";

type Row = {
  id: string; leave_type: LeaveType; start_date: string; days: number; reason: string | null; contact: string | null;
  status: LeaveStatus; dept: string | null; employees: { name: string } | null;
};

function Card({ r, pending }: { r: Row; pending: boolean }) {
  return (
    <li className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">{r.employees?.name} <span className="text-xs font-normal text-slate-400">{r.dept}</span></p>
        <span className="text-sm text-slate-500">{LEAVE_TH[r.leave_type]} · {r.days} วัน · เริ่ม {thDate(r.start_date)}</span>
      </div>
      <p className="mt-1 text-sm text-slate-600">{r.reason}</p>
      <p className="text-xs text-slate-400">ติดต่อ: {r.contact ?? "-"}</p>
      <form action={decideLeave} className="mt-3 flex items-center gap-2">
        <input type="hidden" name="id" value={r.id} />
        {pending ? (
          <>
            <button name="decision" value="approved" className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white">อนุมัติ</button>
            <button name="decision" value="denied" className="rounded-lg bg-red-100 px-4 py-2 text-sm font-semibold text-red-600">ไม่อนุมัติ</button>
          </>
        ) : (
          <>
            <span className="text-sm font-semibold">{STATUS_TH[r.status]}</span>
            <button name="decision" value="pending" className="ml-auto text-xs text-slate-400 underline">ย้อนกลับเป็นรออนุมัติ</button>
          </>
        )}
      </form>
    </li>
  );
}

export default async function Leaves() {
  const sel = "id,leave_type,start_date,days,reason,contact,status,dept,employees(name)";
  const [pending, done] = await Promise.all([
    db().from("leave_requests").select(sel).eq("status", "pending").order("start_date", { ascending: false }).limit(200),
    db().from("leave_requests").select(sel).neq("status", "pending").order("start_date", { ascending: false }).limit(30),
  ]);
  const p = (pending.data ?? []) as unknown as Row[], d = (done.data ?? []) as unknown as Row[];
  return (
    <div className="space-y-6">
      <section>
        <h1 className="mb-2 text-lg font-bold">รออนุมัติ ({p.length})</h1>
        {p.length === 0 && <p className="text-sm text-slate-400">ไม่มีใบลาค้าง</p>}
        <ul className="space-y-2">{p.map((r) => <Card key={r.id} r={r} pending />)}</ul>
      </section>
      <section>
        <h2 className="mb-2 font-bold">ตัดสินแล้ว (30 รายการล่าสุด)</h2>
        <ul className="space-y-2">{d.map((r) => <Card key={r.id} r={r} pending={false} />)}</ul>
      </section>
    </div>
  );
}
