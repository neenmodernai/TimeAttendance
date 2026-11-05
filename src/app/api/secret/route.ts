// src/app/api/secret/route.ts
import { NextResponse } from "next/server";
import { db, getSettings } from "@/lib/db";
import { appUrl, mailConfigured, sendMail, wrap } from "@/lib/mail";
import { hashPin, validPin } from "@/lib/pin";
import { runReminders } from "@/lib/reminders";
import { getRole, isOwner, roleForPassword, setSession } from "@/lib/session";

export const dynamic = "force-dynamic";
const mask = (e: string) => e.replace(/^(.).*(@.*)$/, "$1***$2");

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const no = NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // The developer menu is owner-only: the HR password does not open it.
  if (b.action === "whoami") return NextResponse.json({ owner: isOwner(), role: getRole() });
  if (b.action === "login") {
    if (roleForPassword(String(b.password ?? "")) !== "owner") {
      await new Promise((r) => setTimeout(r, 1000));
      return NextResponse.json({ error: "รหัสเจ้าของไม่ถูกต้อง" }, { status: 401 });
    }
    setSession("admin", "owner", 0.5);
    return NextResponse.json({ ok: true });
  }
  if (!isOwner()) return no;

  const sb = db();
  switch (b.action) {
    case "hash": {
      if (!validPin(b.pin)) return NextResponse.json({ error: "PIN ต้องเป็นตัวเลข 3–6 หลัก" }, { status: 400 });
      return NextResponse.json({ hash: hashPin(b.pin) });
    }
    case "diag": {
      const t0 = Date.now();
      const s = await getSettings(sb);
      const dbMs = Date.now() - t0;
      const n = async (t: string, f?: (q: any) => any) => { let q = sb.from(t).select("id", { count: "exact", head: true }); if (f) q = f(q); return (await q).count ?? null; };
      const [employees, activeEmp, punches, pending, noEmail, log] = await Promise.all([
        n("employees"), n("employees", (q) => q.eq("active", true)), n("punches"), n("leave_requests", (q) => q.eq("status", "pending")),
        n("employees", (q) => q.eq("active", true).is("email", null)),
        sb.from("notification_log").select("kind,for_date,sent_at").order("sent_at", { ascending: false }).limit(5).then((r) => r.data ?? []),
      ]);
      return NextResponse.json({
        db_ms: dbMs, appUrl: appUrl(), serverTime: new Date().toISOString(),
        counts: { employees, active: activeEmp, punches, pending_leaves: pending, active_without_email: noEmail },
        settings: { lateFrom: s.lateFrom, workDays: s.workDays, holidays: s.holidays.length, remindEnabled: s.remindEnabled },
        email: { gmail_configured: mailConfigured(), hr_email: s.hrEmail ? mask(s.hrEmail.split(/[,;\s]+/)[0]) : null },
        cron_secret_set: !!process.env.CRON_SECRET, last_reminders: log,
        owner: { email_set: !!process.env.OWNER_EMAIL, hr_password_differs: !!process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD !== process.env.OWNER_PASSWORD },
        pending_changes: (await sb.from("change_requests").select("id", { count: "exact", head: true }).eq("status", "pending")).count,
      });
    }
    case "test_mail": {
      const s = await getSettings(sb);
      if (!mailConfigured()) return NextResponse.json({ sent: false, reason: "GMAIL_USER / GMAIL_APP_PASSWORD ยังไม่ได้ตั้งค่า" });
      if (!s.hrEmail) return NextResponse.json({ sent: false, reason: "ยังไม่ได้ตั้งอีเมล HR (หน้าพนักงาน > ตั้งค่า)" });
      return NextResponse.json({ sent: await sendMail(s.hrEmail, "ทดสอบอีเมลจากระบบลงเวลา", wrap("<p>อีเมลทดสอบ ✅ ระบบส่งอีเมลทำงานปกติ</p>")) });
    }
    case "reminders": {
      const kind = b.kind === "evening" ? "evening" : "morning";
      return NextResponse.json(await runReminders(kind, { dry: b.mode !== "send", force: true }));
    }
  }
  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
