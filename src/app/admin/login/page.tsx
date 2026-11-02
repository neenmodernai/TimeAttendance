// src/app/admin/login/page.tsx
import { adminLogin } from "../actions";

export default function AdminLogin({ searchParams }: { searchParams: { e?: string } }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-5">
      <form action={adminLogin} className="space-y-4 rounded-3xl bg-white p-6 shadow-xl">
        <h1 className="text-center text-xl font-bold text-slate-800">ผู้ดูแลระบบ</h1>
        <input name="password" type="password" autoFocus placeholder="รหัสผ่านผู้ดูแล"
          className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        {searchParams.e && <p className="rounded-lg bg-red-50 p-2 text-center text-sm text-red-600">รหัสผ่านไม่ถูกต้อง</p>}
        <button className="w-full rounded-xl bg-slate-800 py-3 font-bold text-white">เข้าสู่ระบบ</button>
      </form>
    </main>
  );
}
