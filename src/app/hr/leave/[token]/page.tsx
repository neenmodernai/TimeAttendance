// src/app/hr/leave/[token]/page.tsx
import { getLeave, leaveIdFromToken } from "@/lib/leave";
import { thDate } from "@/lib/time";
import { LEAVE_TH, STATUS_TH } from "@/lib/types";
import { decideByToken } from "../../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "อนุมัติการลา", robots: "noindex" };

export default async function HrLeave({ params, searchParams }: { params: { token: string }; searchParams: { d?: string } }) {
  const id = leaveIdFromToken(params.token);
  const l = id ? await getLeave(id) : null;
  if (!l) {
    return <main className="mx-auto max-w-md p-6"><p className="rounded-2xl bg-white p-6 text-center shadow">ลิงก์นี้ไม่ถูกต้องหรือหมดอายุ (ใช้ได้ 14 วัน)<br />กรุณาอนุมัติที่หน้า /admin/leaves</p></main>;
  }
  const rows: [string, string][] = [
    ["พนักงาน", `${l.employees?.name ?? "-"}${l.dept ? ` (${l.dept})` : ""}`], ["ประเภท", LEAVE_TH[l.leave_type]],
    ["เริ่มลา", thDate(l.start_date)], ["จำนวน", `${l.days} วัน`], ["เหตุผล", l.reason ?? "-"], ["ติดต่อ", l.contact ?? "-"],
  ];
  return (
    <main className="mx-auto max-w-md p-4">
      <div className="space-y-4 rounded-3xl bg-white p-6 shadow-xl">
        <h1 className="text-xl font-bold">คำขอลา</h1>
        <dl className="space-y-1 text-sm">
          {rows.map(([k, v]) => <div key={k} className="flex gap-3"><dt className="w-20 text-slate-500">{k}</dt><dd className="flex-1 font-medium">{v}</dd></div>)}
        </dl>
        {l.status === "pending" ? (
          <form action={decideByToken} className="grid grid-cols-2 gap-3">
            <input type="hidden" name="token" value={params.token} />
            <button name="decision" value="approved" className={`rounded-xl bg-green-600 py-3 font-bold text-white ${searchParams.d === "approved" ? "ring-4 ring-green-300" : ""}`}>✓ อนุมัติ</button>
            <button name="decision" value="denied" className={`rounded-xl bg-red-600 py-3 font-bold text-white ${searchParams.d === "denied" ? "ring-4 ring-red-300" : ""}`}>✗ ไม่อนุมัติ</button>
          </form>
        ) : (
          <p className="rounded-xl bg-slate-100 p-4 text-center font-semibold">ดำเนินการแล้ว: {STATUS_TH[l.status]}</p>
        )}
      </div>
    </main>
  );
}
