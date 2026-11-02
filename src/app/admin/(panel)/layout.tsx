// src/app/admin/(panel)/layout.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/session";
import { adminLogout } from "../actions";
import { SecretTitle } from "@/components/SecretMenu";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  if (!isAdmin()) redirect("/admin/login");
  const { count } = await db().from("leave_requests").select("id", { count: "exact", head: true }).eq("status", "pending");
  const links: [string, string][] = [["/admin", "วันนี้"], ["/admin/leaves", count ? `ใบลา (${count})` : "ใบลา"], ["/admin/hr", "HR Dashboard"], ["/admin/report", "รายงาน"], ["/admin/employees", "พนักงาน"]];
  return (
    <div className="mx-auto max-w-5xl p-4">
      <header className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl bg-white p-3 shadow-sm">
        <SecretTitle className="mr-2 font-bold text-indigo-600">ผู้ดูแล</SecretTitle>
        {links.map(([h, t]) => (
          <Link key={h} href={h} className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">{t}</Link>
        ))}
        <form action={adminLogout} className="ml-auto"><button className="text-xs text-slate-400">ออกจากระบบ</button></form>
      </header>
      {children}
    </div>
  );
}
