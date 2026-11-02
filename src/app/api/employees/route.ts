// src/app/api/employees/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Names only (no PINs, contacts or departments) - used for the login picker. */
export async function GET() {
  const { data } = await db().from("employees").select("id,name").eq("active", true);
  const list = (data ?? []).sort((a, b) => a.name.localeCompare(b.name, "th"));
  return NextResponse.json({ employees: list });
}
