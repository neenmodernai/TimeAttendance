// src/app/admin/(panel)/approvals/page.tsx
import { db } from "@/lib/db";
import type { ChangeRow } from "@/lib/changes";
import { getRole } from "@/lib/session";
import { bkkTime, bkkDate, thDate } from "@/lib/time";
import { cancelChange, decideChange } from "../../actions";

const when = (iso: string) => `${thDate(bkkDate(iso))} ${bkkTime(iso)}`;
const BADGE = { pending: ["รออนุมัติ", "bg-amber-100 text-amber-700"], approved: ["อนุมัติแล้ว", "bg-green-100 text-green-700"], rejected: ["ไม่อนุมัติ", "bg-red-100 text-red-600"] } as const;

export default async function Approvals({ searchParams }: { searchParams: { e?: string; ok?: string } }) {
  const owner = getRole() === "owner";
  const [pending, done] = await Promise.all([
    db().from("change_requests").select("*").eq("status", "pending").order("created_at").then((r) => (r.data ?? []) as ChangeRow[]),
    db().from("change_requests").select("*").neq("status", "pending").order("decided_at", { ascending: false }).limit(30).then((r) => (r.data ?? []) as ChangeRow[]),
  ]);
  const who = (r: string) => (r === "owner" ? "เจ้าของ" : "HR");
  return (
    <div className="space-y-5">
      {searchParams.e && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{searchParams.e}</p>}
      {searchParams.ok && <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{searchParams.ok}</p>}
      <section>
        <h1 className="mb-2 text-lg font-bold">รอเจ้าของอนุมัติ ({pending.length})</h1>
        {!owner && <p className="mb-2 text-sm text-slate-500">HR ส่งคำขอได้ เจ้าของเป็นผู้อนุมัติ (เจ้าของได้รับอีเมลแจ้งด้วย)</p>}
        {pending.length === 0 && <p className="text-sm text-slate-400">ไม่มีคำขอค้าง</p>}
        <ul className="space-y-2">
          {pending.map((c) => (
            <li key={c.id} className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="font-medium">{c.summary}</p>
              <p className="text-xs text-slate-400">ส่งโดย {who(c.requested_by)} · {when(c.created_at)}</p>
              {owner ? (
                <form action={decideChange} className="mt-3 flex flex-wrap items-center gap-2">
                  <input type="hidden" name="id" value={c.id} />
                  <input name="note" placeholder="หมายเหตุถึง HR (ถ้ามี)" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  <button name="decision" value="approved" className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white">อนุมัติ</button>
                  <button name="decision" value="rejected" className="rounded-lg bg-red-100 px-4 py-2 text-sm font-semibold text-red-600">ไม่อนุมัติ</button>
                </form>
              ) : (
                <form action={cancelChange} className="mt-2"><input type="hidden" name="id" value={c.id} /><button className="text-xs text-slate-500 underline">ยกเลิกคำขอ</button></form>
              )}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="mb-2 font-bold">ประวัติ (30 รายการล่าสุด)</h2>
        <ul className="divide-y rounded-2xl bg-white text-sm shadow-sm">
          {done.map((c) => (
            <li key={c.id} className="flex flex-wrap items-start justify-between gap-2 p-3">
              <div>
                <p>{c.summary}</p>
                <p className="text-xs text-slate-400">
                  {who(c.requested_by)} · {when(c.created_at)}{c.decided_at && c.requested_by !== "owner" ? ` → ${when(c.decided_at)}` : ""}
                  {c.owner_note && <> · “{c.owner_note}”</>}
                </p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${BADGE[c.status][1]}`}>{c.requested_by === "owner" ? "เจ้าของแก้ไขเอง" : BADGE[c.status][0]}</span>
            </li>
          ))}
          {done.length === 0 && <li className="p-3 text-slate-400">ยังไม่มี</li>}
        </ul>
      </section>
    </div>
  );
}
