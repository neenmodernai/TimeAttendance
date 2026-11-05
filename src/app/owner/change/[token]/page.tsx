// src/app/owner/change/[token]/page.tsx
import { changeIdFromToken, getChange } from "@/lib/changes";
import { decideChangeByToken } from "../../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "อนุมัติการเปลี่ยนแปลง", robots: "noindex" };
const DONE = { approved: "อนุมัติแล้ว ✅", rejected: "ไม่อนุมัติ ❌", pending: "" } as const;

export default async function OwnerChange({ params, searchParams }: { params: { token: string }; searchParams: { d?: string } }) {
  const id = changeIdFromToken(params.token);
  const c = id ? await getChange(id) : null;
  if (!c) return <main className="mx-auto max-w-md p-6"><p className="rounded-2xl bg-white p-6 text-center shadow">ลิงก์ไม่ถูกต้องหรือหมดอายุ (ใช้ได้ 14 วัน)<br />ดูได้ที่ /admin/approvals</p></main>;
  return (
    <main className="mx-auto max-w-md p-4">
      <div className="space-y-4 rounded-3xl bg-white p-6 shadow-xl">
        <h1 className="text-xl font-bold">HR ขอเปลี่ยนแปลง</h1>
        <p className="rounded-xl bg-slate-50 p-3 font-medium">{c.summary}</p>
        {c.status === "pending" ? (
          <form action={decideChangeByToken} className="space-y-3">
            <input type="hidden" name="token" value={params.token} />
            <input name="note" placeholder="หมายเหตุถึง HR (ถ้ามี)" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
            <div className="grid grid-cols-2 gap-3">
              <button name="decision" value="approved" className={`rounded-xl bg-green-600 py-3 font-bold text-white ${searchParams.d === "approved" ? "ring-4 ring-green-300" : ""}`}>✓ อนุมัติ</button>
              <button name="decision" value="rejected" className={`rounded-xl bg-red-600 py-3 font-bold text-white ${searchParams.d === "rejected" ? "ring-4 ring-red-300" : ""}`}>✗ ไม่อนุมัติ</button>
            </div>
          </form>
        ) : (
          <p className="rounded-xl bg-slate-100 p-4 text-center font-semibold">ดำเนินการแล้ว: {DONE[c.status]}</p>
        )}
      </div>
    </main>
  );
}
