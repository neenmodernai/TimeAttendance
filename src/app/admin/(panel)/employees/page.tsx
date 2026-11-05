// src/app/admin/(panel)/employees/page.tsx
import { db } from "@/lib/db";
import { DEPTS } from "@/lib/types";
import { addEmployee, resetPin, setEmail, toggleActive } from "../../actions";

const box = "rounded-lg border border-slate-300 px-3 py-2 text-sm";

export default async function Employees({ searchParams }: { searchParams: { e?: string } }) {
  const { data } = await db().from("employees").select("id,name,dept,active,email").order("name");
  const list = (data ?? []).sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, "th"));
  return (
    <div className="space-y-6">
      {searchParams.e && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{searchParams.e}</p>}

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-2 font-bold">เพิ่มพนักงาน</h2>
        <form action={addEmployee} className="flex flex-wrap gap-2">
          <input name="name" placeholder="ชื่อ-นามสกุล" className={`${box} flex-1`} required />
          <input name="pin" placeholder="PIN 3–6 หลัก" inputMode="numeric" className={`${box} w-36`} required />
          <select name="dept" className={box}><option value="">แผนก</option>{DEPTS.map((d) => <option key={d}>{d}</option>)}</select>
          <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">เพิ่ม</button>
        </form>
      </section>

      <section className="overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500"><tr><th className="p-3">ชื่อ</th><th>แผนก</th><th>อีเมล (รับแจ้งเตือน)</th><th>รีเซ็ต PIN</th><th></th></tr></thead>
          <tbody className="divide-y">
            {list.map((e) => (
              <tr key={e.id} className={e.active ? "" : "text-slate-400"}>
                <td className="p-3 font-medium">{e.name}</td><td>{e.dept ?? "-"}</td>
                <td>
                  <form action={setEmail} className="flex gap-1">
                    <input type="hidden" name="id" value={e.id} />
                    <input name="email" type="email" defaultValue={e.email ?? ""} placeholder="ยังไม่มี" className={`${box} w-44 py-1`} />
                    <button className="rounded-lg border px-2 text-xs">บันทึก</button>
                  </form>
                </td>
                <td>
                  <form action={resetPin} className="flex gap-1">
                    <input type="hidden" name="id" value={e.id} />
                    <input name="pin" placeholder="PIN ใหม่" inputMode="numeric" className={`${box} w-24 py-1`} />
                    <button className="rounded-lg border px-2 text-xs">บันทึก</button>
                  </form>
                </td>
                <td>
                  <form action={toggleActive}>
                    <input type="hidden" name="id" value={e.id} /><input type="hidden" name="activate" value={e.active ? "0" : "1"} />
                    <button className="text-xs underline">{e.active ? "ปิดการใช้งาน" : "เปิดใช้งานอีกครั้ง"}</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

    </div>
  );
}
