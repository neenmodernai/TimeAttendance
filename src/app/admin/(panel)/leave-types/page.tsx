// src/app/admin/(panel)/leave-types/page.tsx
import Link from "next/link";
import { db } from "@/lib/db";
import { fmtDays, getLeaveTypes, quotaAll } from "@/lib/quota";
import { getRole } from "@/lib/session";
import { bkkDate } from "@/lib/time";
import { cancelChange, saveEmployeeQuota, saveLeaveType } from "../../actions";

const box = "rounded-lg border border-slate-300 px-2 py-1.5 text-sm";

export default async function LeaveTypes({ searchParams }: { searchParams: { e?: string; ok?: string; y?: string } }) {
  const owner = getRole() === "owner";
  const thisYear = Number(bkkDate().slice(0, 4));
  const year = /^\d{4}$/.test(searchParams.y ?? "") ? Number(searchParams.y) : thisYear;
  const sb = db();
  const [types, { forEmployee }, emps, overrides, pending] = await Promise.all([
    getLeaveTypes(sb, true),
    quotaAll(year, sb),
    sb.from("employees").select("id,name").eq("active", true).then((r) => (r.data ?? []).sort((a, b) => a.name.localeCompare(b.name, "th"))),
    sb.from("employee_leave_quotas").select("employee_id,leave_type,annual_days").then((r) => r.data ?? []),
    sb.from("change_requests").select("id,summary,created_at").eq("status", "pending").order("created_at").then((r) => r.data ?? []),
  ]);
  const active = types.filter((t) => t.active);
  const submitLabel = owner ? "บันทึก" : "ส่งขออนุมัติ";

  return (
    <div className="space-y-5">
      {searchParams.e && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{searchParams.e}</p>}
      {searchParams.ok && <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{searchParams.ok}</p>}
      {!owner && <p className="rounded-lg bg-indigo-50 p-3 text-sm text-indigo-800">การเปลี่ยนสิทธิ์การลาต้องให้เจ้าของอนุมัติก่อน จึงจะมีผล</p>}
      {pending.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm">
          <h2 className="mb-1 font-semibold text-amber-800">รอเจ้าของอนุมัติ ({pending.length})</h2>
          <ul className="space-y-1">
            {pending.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2">
                <span>{c.summary}</span>
                <form action={cancelChange}><input type="hidden" name="id" value={c.id} /><button className="text-xs text-slate-500 underline">ยกเลิก</button></form>
              </li>
            ))}
          </ul>
          {owner && <Link href="/admin/approvals" className="mt-2 inline-block text-xs font-semibold text-indigo-700 underline">ไปหน้าอนุมัติ</Link>}
        </section>
      )}

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-1 font-bold">ประเภทการลาและสิทธิ์ต่อปี</h2>
        <p className="mb-3 text-xs text-slate-400">นับตามปีปฏิทิน (ม.ค.–ธ.ค.) ตามวันที่เริ่มลา · เว้นช่องวันว่าง = ไม่จำกัด · “ลาเกินได้” = ยังส่งใบลาได้เมื่อสิทธิ์หมด แต่ HR จะเห็นว่าเกินสิทธิ์</p>
        <div className="space-y-2">
          {types.map((t) => (
            <form key={t.code} action={saveLeaveType} className={`flex flex-wrap items-center gap-2 rounded-xl border p-2 ${t.active ? "" : "bg-slate-50 opacity-70"}`}>
              <input type="hidden" name="code" value={t.code} />
              <input name="name_th" defaultValue={t.name_th} className={`${box} w-36`} />
              <label className="flex items-center gap-1 text-sm"><input name="annual_days" defaultValue={t.annual_days ?? ""} inputMode="decimal" placeholder="ไม่จำกัด" className={`${box} w-20 text-center`} /> วัน/ปี</label>
              <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="allow_over" defaultChecked={t.allow_over} />ลาเกินได้</label>
              <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="active" defaultChecked={t.active} />เปิดใช้</label>
              <label className="flex items-center gap-1 text-xs">ลำดับ<input name="sort" defaultValue={t.sort} inputMode="numeric" className={`${box} w-12 text-center`} /></label>
              <button className="ml-auto rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white">{submitLabel}</button>
            </form>
          ))}
        </div>
        <form action={saveLeaveType} className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-dashed p-2">
          <span className="text-sm font-semibold text-slate-500">+ เพิ่มประเภท</span>
          <input name="name_th" placeholder="เช่น ลาคลอด" className={`${box} w-36`} required />
          <label className="flex items-center gap-1 text-sm"><input name="annual_days" inputMode="decimal" placeholder="ไม่จำกัด" className={`${box} w-20 text-center`} /> วัน/ปี</label>
          <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="allow_over" />ลาเกินได้</label>
          <button className="ml-auto rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white">{submitLabel}</button>
        </form>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-1 font-bold">สิทธิ์เฉพาะคน</h2>
        <p className="mb-3 text-xs text-slate-400">ใช้แทนค่าปกติสำหรับพนักงานคนนั้น (เช่น พักร้อนเพิ่มตามอายุงาน) · เว้นว่างแล้วบันทึก = กลับไปใช้ค่าปกติ</p>
        <form action={saveEmployeeQuota} className="flex flex-wrap items-center gap-2">
          <select name="employee_id" className={box} required><option value="">พนักงาน</option>{emps.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
          <select name="leave_type" className={box} required><option value="">ประเภท</option>{active.map((t) => <option key={t.code} value={t.code}>{t.name_th}</option>)}</select>
          <input name="annual_days" inputMode="decimal" placeholder="วัน/ปี" className={`${box} w-24 text-center`} />
          <button className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white">{submitLabel}</button>
        </form>
        {overrides.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm text-slate-600">
            {overrides.map((o) => (
              <li key={o.employee_id + o.leave_type}>• {emps.find((e) => e.id === o.employee_id)?.name ?? "(ปิดใช้งาน)"} — {types.find((t) => t.code === o.leave_type)?.name_th}: {fmtDays(Number(o.annual_days))} วัน/ปี</li>
            ))}
          </ul>
        )}
      </section>

      <section className="overflow-x-auto rounded-2xl bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center gap-2">
          <h2 className="font-bold">คงเหลือรายคน ปี {year + 543}</h2>
          <Link href={`?y=${year - 1}`} className="rounded border px-2 text-sm">‹</Link>
          {year !== thisYear && <Link href="?" className="rounded border px-2 text-sm">ปีนี้</Link>}
          <Link href={`?y=${year + 1}`} className="rounded border px-2 text-sm">›</Link>
        </div>
        <table className="w-full min-w-[560px] text-sm">
          <thead className="text-left text-xs text-slate-500">
            <tr><th className="py-1">ชื่อ</th>{active.map((t) => <th key={t.code}>{t.name_th} <span className="font-normal">(เหลือ/สิทธิ์)</span></th>)}</tr>
          </thead>
          <tbody className="divide-y">
            {emps.map((e) => (
              <tr key={e.id}>
                <td className="py-1.5"><Link className="text-indigo-700 underline" href={`/admin/report?emp=${e.id}`}>{e.name}</Link></td>
                {forEmployee(e.id).map((q) => (
                  <td key={q.code} className={q.remaining === 0 ? "font-semibold text-orange-600" : ""}>
                    {q.limit === null ? `ใช้ ${fmtDays(q.used)}` : `${fmtDays(q.remaining)}/${fmtDays(q.limit)}`}
                    {q.pending > 0 && <span className="text-xs text-amber-600"> (รอ {fmtDays(q.pending)})</span>}
                    {q.custom && <span className="text-[10px] text-indigo-600"> *</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-[10px] text-slate-400">* = สิทธิ์เฉพาะคน</p>
      </section>
    </div>
  );
}
