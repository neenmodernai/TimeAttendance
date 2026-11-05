// src/components/AdminNav.tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_VERSION } from "@/lib/version";

export function AdminNav({ pending, changes, role, logout }: { pending: number; changes: number; role: "hr" | "owner"; logout: () => Promise<void> }) {
  const path = usePathname();
  const tabs: [string, string][] = [
    ["/admin", "ภาพรวม"],
    ["/admin/leaves", pending ? `ใบลา (${pending})` : "ใบลา"],
    ["/admin/report", "รายบุคคล"],
    ["/admin/leave-types", "สิทธิ์การลา"],
    ["/admin/employees", "พนักงาน"],
    ["/admin/approvals", changes ? `รออนุมัติ (${changes})` : "คำขอเปลี่ยนแปลง"],
    ["/admin/settings", "ตั้งค่า"],
  ];
  const active = (h: string) => (h === "/admin" ? path === "/admin" : path.startsWith(h));
  return (
    <header className="sticky top-0 z-30 -mx-4 mb-4 border-b bg-white/95 px-4 backdrop-blur">
      <div className="flex items-center gap-3 py-2">
        <Link href="/" className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100">← หน้าลงเวลา</Link>
        <span className="font-bold text-indigo-600">HR</span>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${role === "owner" ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-600"}`}>{role === "owner" ? "เจ้าของ" : "HR"}</span>
        <span className="text-[10px] text-slate-300">v{APP_VERSION}</span>
        <form action={logout} className="ml-auto"><button className="text-xs text-slate-400 hover:text-slate-600">ออกจากระบบ</button></form>
      </div>
      <nav className="-mb-px flex gap-1 overflow-x-auto">
        {tabs.map(([h, t]) => (
          <Link key={h} href={h}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${active(h) ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-700"} ${h === "/admin/approvals" && changes && role === "owner" ? "text-purple-700" : ""}`}>
            {t}
          </Link>
        ))}
      </nav>
    </header>
  );
}
