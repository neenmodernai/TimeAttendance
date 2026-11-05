// src/app/admin/(panel)/settings/page.tsx
import { db, getSettings } from "@/lib/db";
import { saveSettings } from "../../actions";

const box = "rounded-lg border border-slate-300 px-3 py-2 text-sm";
const DAYS = ["จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส.", "อา."];

export default async function Settings({ searchParams }: { searchParams: { e?: string; ok?: string } }) {
  const [settings, sites] = await Promise.all([
    getSettings(),
    db().from("sites").select("name,lat,lng,radius_m,active").then((r) => r.data ?? []),
  ]);
  return (
    <div className="space-y-4">
      {searchParams.e && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{searchParams.e}</p>}
      {searchParams.ok && <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700">บันทึกแล้ว</p>}
      <form action={saveSettings} className="space-y-5 rounded-2xl bg-white p-4 text-sm shadow-sm">
        <section className="space-y-2">
          <h2 className="font-bold">เวลาทำงาน</h2>
          <label className="flex flex-wrap items-center gap-2">เข้างานตั้งแต่เวลา
            <input type="time" name="late_from" defaultValue={settings.lateFrom} className={box} /> ถือว่า “สาย”
          </label>
          <div className="flex flex-wrap items-center gap-3">วันทำงาน
            {DAYS.map((d, i) => (
              <label key={d} className="flex items-center gap-1"><input type="checkbox" name={`d${i + 1}`} defaultChecked={settings.workDays.includes(i + 1)} />{d}</label>
            ))}
          </div>
          <label className="block">วันหยุดนักขัตฤกษ์ / วันหยุดบริษัท (วันละบรรทัด รูปแบบ 2026-12-31) — ไม่นับเป็น “ไม่มีบันทึก”
            <textarea name="holidays" rows={5} defaultValue={settings.holidays.join("\n")} className={`${box} mt-1 w-full font-mono`} />
          </label>
        </section>
        <section className="space-y-2 border-t pt-4">
          <h2 className="font-bold">อีเมลและการแจ้งเตือน</h2>
          <label className="block">อีเมล HR (รับใบลา + สรุปคนไม่ลงเวลา; หลายอีเมลคั่นด้วย ,)
            <input name="hr_email" defaultValue={settings.hrEmail} placeholder="hr@example.com" className={`${box} mt-1 w-full`} />
          </label>
          <label className="flex items-center gap-2"><input type="checkbox" name="remind_enabled" defaultChecked={settings.remindEnabled} />ส่งอีเมลเตือนคนที่ยังไม่ลงเวลา (เช้า ~09:30 / เย็น ~19:00)</label>
        </section>
        <button className="rounded-lg bg-indigo-600 px-5 py-2.5 font-semibold text-white">บันทึกการตั้งค่า</button>
      </form>
      <section className="rounded-2xl bg-white p-4 text-sm shadow-sm">
        <h2 className="mb-1 font-bold">จุดลงเวลา</h2>
        <p className="mb-2 text-xs text-slate-400">แก้ไขที่ Supabase &gt; Table Editor &gt; sites</p>
        <ul className="space-y-1 text-slate-600">
          {sites.map((s) => <li key={s.name}>{s.name}: {s.lat}, {s.lng} · รัศมี {s.radius_m} ม. {s.active ? "" : "(ปิด)"}</li>)}
        </ul>
      </section>
    </div>
  );
}
