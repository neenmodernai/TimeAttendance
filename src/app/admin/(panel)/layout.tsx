// src/app/admin/(panel)/layout.tsx
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getRole } from "@/lib/session";
import { AdminNav } from "@/components/AdminNav";
import { adminLogout } from "../actions";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const role = getRole();
  if (!role) redirect("/admin/login");
  const [{ count }, { count: changes }] = await Promise.all([
    db().from("leave_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    db().from("change_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);
  return (
    <div className="mx-auto max-w-5xl px-4 pb-10">
      <AdminNav pending={count ?? 0} changes={changes ?? 0} role={role} logout={adminLogout} />
      {children}
    </div>
  );
}
