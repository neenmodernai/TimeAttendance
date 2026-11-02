// src/app/admin/actions.ts
"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { hashPin, validPin } from "@/lib/pin";
import { checkAdminPassword, clearSession, isAdmin, setSession } from "@/lib/session";
import { applyDecision } from "@/lib/leave";
import { bkkDate } from "@/lib/time";
import { DEPTS } from "@/lib/types";

function guard() { if (!isAdmin()) redirect("/admin/login"); }

export async function adminLogin(fd: FormData) {
  const pw = String(fd.get("password") ?? "");
  if (!checkAdminPassword(pw)) {
    await new Promise((r) => setTimeout(r, 1000)); // slow down guessing
    redirect("/admin/login?e=1");
  }
  setSession("admin", undefined, 0.5); // 12 hours
  redirect("/admin");
}

export async function adminLogout() { clearSession("admin"); redirect("/admin/login"); }

export async function decideLeave(fd: FormData) {
  guard();
  const decision = fd.get("decision");
  if (decision !== "approved" && decision !== "denied" && decision !== "pending") return;
  await applyDecision(String(fd.get("id")), decision, "admin");
  revalidatePath("/admin", "layout");
}

export async function addEmployee(fd: FormData) {
  guard();
  const name = String(fd.get("name") ?? "").replace(/\s+/g, " ").trim();
  const pin = String(fd.get("pin") ?? "");
  const dept = String(fd.get("dept") ?? "");
  if (!name || !validPin(pin)) redirect("/admin/employees?e=" + encodeURIComponent("กรอกชื่อและ PIN 3–6 หลัก"));
  const { error } = await db().from("employees").insert({
    name, pin_hash: hashPin(pin), dept: (DEPTS as readonly string[]).includes(dept) ? dept : null,
  });
  if (error) redirect("/admin/employees?e=" + encodeURIComponent("เพิ่มไม่ได้ (ชื่อซ้ำหรือไม่ถูกต้อง)"));
  revalidatePath("/admin/employees");
}

export async function resetPin(fd: FormData) {
  guard();
  const pin = String(fd.get("pin") ?? "");
  if (!validPin(pin)) redirect("/admin/employees?e=" + encodeURIComponent("PIN ต้องเป็นตัวเลข 3–6 หลัก"));
  const id = String(fd.get("id"));
  await db().from("employees").update({ pin_hash: hashPin(pin) }).eq("id", id);
  await db().from("login_attempts").delete().eq("employee_id", id);
  revalidatePath("/admin/employees");
}

export async function toggleActive(fd: FormData) {
  guard();
  const activate = fd.get("activate") === "1";
  await db().from("employees").update({ active: activate, ended_on: activate ? null : bkkDate() }).eq("id", String(fd.get("id")));
  revalidatePath("/admin", "layout");
}

export async function setEmail(fd: FormData) {
  guard();
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) redirect("/admin/employees?e=" + encodeURIComponent("รูปแบบอีเมลไม่ถูกต้อง"));
  await db().from("employees").update({ email: email || null }).eq("id", String(fd.get("id")));
  revalidatePath("/admin/employees");
}

export async function saveSettings(fd: FormData) {
  guard();
  const late = String(fd.get("late_from") ?? "");
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(late)) redirect("/admin/employees?e=" + encodeURIComponent("เวลาไม่ถูกต้อง"));
  const days = [1, 2, 3, 4, 5, 6, 7].filter((d) => fd.get(`d${d}`) === "on");
  const holidays = String(fd.get("holidays") ?? "").split(/[\s,]+/).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
  await db().from("settings").upsert([
    { key: "late_from", value: late }, { key: "work_days", value: days }, { key: "holidays", value: [...new Set(holidays)].sort() },
    { key: "hr_email", value: String(fd.get("hr_email") ?? "").trim() }, { key: "remind_enabled", value: fd.get("remind_enabled") === "on" },
  ]);
  revalidatePath("/admin", "layout");
}
