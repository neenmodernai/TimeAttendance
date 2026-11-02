// src/app/api/logout/route.ts
import { NextResponse } from "next/server";
import { clearSession } from "@/lib/session";

export async function POST() {
  clearSession("emp");
  return NextResponse.json({ ok: true });
}
