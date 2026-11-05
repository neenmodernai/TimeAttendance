// src/components/SecretMenu.tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { APP_VERSION, VERSION_HISTORY } from "@/lib/version";

/* ---- console capture: starts as soon as this module loads in the browser ---- */
type Log = { t: string; l: string; m: string };
const LOGS: Log[] = [];
const safe = (a: unknown) => { if (typeof a === "string") return a; try { return a instanceof Error ? a.message : JSON.stringify(a); } catch { return String(a); } };
const push = (l: string, args: unknown[]) => {
  LOGS.push({ t: new Date().toLocaleTimeString("th-TH"), l, m: args.map(safe).join(" ") });
  if (LOGS.length > 300) LOGS.shift();
};
function hook() {
  const w = window as unknown as { __logHook?: boolean };
  if (w.__logHook) return;
  w.__logHook = true;
  (["log", "info", "warn", "error"] as const).forEach((k) => {
    const orig = console[k];
    console[k] = (...a: unknown[]) => { push(k, a); orig.apply(console, a); };
  });
  window.addEventListener("error", (e) => push("error", [e.message]));
  window.addEventListener("unhandledrejection", (e) => push("error", ["unhandled:", e.reason]));
  const of = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const t0 = performance.now();
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method ?? (typeof input === "object" && "method" in input ? input.method : "GET");
    try {
      const r = await of(input, init);
      push(r.ok ? "info" : "warn", [`fetch ${method} ${url.replace(location.origin, "")} → ${r.status} (${Math.round(performance.now() - t0)}ms)`]);
      return r;
    } catch (e) { push("error", [`fetch ${method} ${url} failed:`, e]); throw e; }
  };
}
if (typeof window !== "undefined") hook();

/** 3 quick taps on the wrapped element. target "hr" opens the HR login, "dev" opens the owner-only developer menu. */
export function TripleTap({ children, className = "", target }: { children: React.ReactNode; className?: string; target: "hr" | "dev" }) {
  const n = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  return (
    <span className={`cursor-pointer select-none ${className}`} onClick={() => {
      n.current++;
      clearTimeout(timer.current);
      if (n.current >= 3) {
        n.current = 0;
        if (target === "hr") window.location.href = "/admin";
        else window.dispatchEvent(new Event("open-secret-menu"));
      } else timer.current = setTimeout(() => { n.current = 0; }, 800);
    }}>{children}</span>
  );
}

const post = (body: unknown) => fetch("/api/secret", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
const box = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";
const btn = "rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40";

export function SecretMenu() {
  const [open, setOpen] = useState(false);
  const [admin, setAdmin] = useState<boolean | null>(null); // true = owner session
  const [pw, setPw] = useState(""); const [err, setErr] = useState("");
  const [pin, setPin] = useState(""); const [hash, setHash] = useState("");
  const [out, setOut] = useState(""); const [busy, setBusy] = useState(false);
  const [logs, setLogs] = useState<Log[]>([]);

  useEffect(() => {
    const h = () => { setOpen(true); setLogs([...LOGS]); post({ action: "whoami" }).then((j) => setAdmin(!!j.owner)); };
    window.addEventListener("open-secret-menu", h);
    return () => window.removeEventListener("open-secret-menu", h);
  }, []);
  if (!open) return null;
  const onAdmin = typeof window !== "undefined" && window.location.pathname.startsWith("/admin");

  const run = async (body: object) => { setBusy(true); setOut("…"); const j = await post(body); setOut(JSON.stringify(j, null, 2)); setBusy(false); };
  async function login() {
    const j = await post({ action: "login", password: pw });
    if (j.ok) { setAdmin(true); setErr(""); setPw(""); } else setErr(j.error ?? "ไม่สำเร็จ");
  }
  async function gen() { const j = await post({ action: "hash", pin }); setHash(j.hash ?? j.error ?? ""); }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={() => setOpen(false)}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between border-b pb-2">
          <h2 className="font-bold text-slate-700">เมนูนักพัฒนา <span className="text-xs font-normal text-slate-400">v{APP_VERSION}</span></h2>
          <button className="text-2xl text-slate-400" onClick={() => setOpen(false)}>&times;</button>
        </div>

        {admin === null && <p className="text-sm text-slate-400">กำลังตรวจสอบ…</p>}
        {admin === false && (
          <div className="space-y-2">
            <p className="text-sm text-slate-500">เมนูนี้สำหรับเจ้าของระบบเท่านั้น ใส่รหัสเจ้าของ (OWNER_PASSWORD)</p>
            <input type="password" className={box} value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && login()} />
            {err && <p className="text-xs text-red-600">{err}</p>}
            <button className={btn} onClick={login}>เข้าสู่ระบบ</button>
          </div>
        )}

        {admin && (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              {onAdmin
                ? <a href="/" className={btn}>← กลับหน้าลงเวลา</a>
                : <a href="/admin" className={btn}>เปิดหน้า HR</a>}
            </div>

            <section>
              <h3 className="mb-1 text-[11px] font-bold uppercase text-indigo-500">Version History</h3>
              <ul className="space-y-1 text-xs text-slate-500">{VERSION_HISTORY.map(([v, d]) => <li key={v}>• <b>{v}</b>: {d}</li>)}</ul>
            </section>

            <section className="border-t pt-3">
              <h3 className="mb-1 text-[11px] font-bold uppercase text-slate-500">PIN Hash Generator (scrypt)</h3>
              <div className="flex gap-2"><input className={box} inputMode="numeric" maxLength={6} placeholder="PIN 3–6 หลัก" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} /><button className={btn} onClick={gen}>สร้าง</button></div>
              {hash && <textarea readOnly rows={3} className={`${box} mt-2 bg-slate-100 font-mono text-[10px]`} value={hash} onFocus={(e) => e.target.select()} />}
              <p className="mt-1 text-[10px] text-slate-400">ใช้กับ SQL: update employees set pin_hash = &apos;…&apos; where name = &apos;…&apos;; (ปกติให้ใช้ปุ่ม “รีเซ็ต PIN” ในหน้าพนักงาน)</p>
            </section>

            <section className="border-t pt-3">
              <h3 className="mb-2 text-[11px] font-bold uppercase text-slate-500">System / Email / Reminders</h3>
              <div className="flex flex-wrap gap-2">
                <button disabled={busy} className={btn} onClick={() => run({ action: "diag" })}>ตรวจสอบระบบ</button>
                <button disabled={busy} className={btn} onClick={() => run({ action: "test_mail" })}>ส่งอีเมลทดสอบถึง HR</button>
                <button disabled={busy} className={btn} onClick={() => run({ action: "reminders", kind: "morning", mode: "dry" })}>ดูคนที่ยังไม่เข้างาน</button>
                <button disabled={busy} className={btn} onClick={() => run({ action: "reminders", kind: "evening", mode: "dry" })}>ดูคนที่ยังไม่ออกงาน</button>
                <button disabled={busy} className={`${btn} !bg-red-600`} onClick={() => confirm("ส่งอีเมลเตือนเช้าให้ทุกคนที่ยังไม่ลงเวลาตอนนี้?") && run({ action: "reminders", kind: "morning", mode: "send" })}>ส่งเตือนเช้าเดี๋ยวนี้</button>
              </div>
              {out && <pre className="mt-2 max-h-56 overflow-auto rounded-lg bg-slate-900 p-3 text-[10px] text-green-300">{out}</pre>}
            </section>

            <section className="border-t pt-3">
              <div className="mb-1 flex items-center justify-between">
                <h3 className="text-[11px] font-bold uppercase text-slate-500">Console Log ({logs.length})</h3>
                <div className="flex gap-2">
                  <button className="text-xs underline" onClick={() => setLogs([...LOGS])}>รีเฟรช</button>
                  <button className="text-xs underline" onClick={() => navigator.clipboard?.writeText(logs.map((l) => `${l.t} [${l.l}] ${l.m}`).join("\n"))}>คัดลอก</button>
                  <button className="text-xs underline" onClick={() => { LOGS.length = 0; setLogs([]); }}>ล้าง</button>
                </div>
              </div>
              <div className="max-h-48 overflow-auto rounded-lg bg-slate-900 p-2 font-mono text-[10px] leading-4">
                {logs.length === 0 && <span className="text-slate-500">ยังไม่มี log</span>}
                {logs.map((l, i) => (
                  <div key={i} className={l.l === "error" ? "text-red-400" : l.l === "warn" ? "text-amber-300" : "text-slate-300"}>{l.t} [{l.l}] {l.m}</div>
                ))}
              </div>
              <p className="mt-1 break-all text-[10px] text-slate-400">{typeof navigator !== "undefined" ? navigator.userAgent : ""}</p>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
