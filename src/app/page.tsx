// src/app/page.tsx
"use client";
import { useCallback, useEffect, useState } from "react";
import { SecretTitle } from "@/components/SecretMenu";
import { APP_VERSION } from "@/lib/version";
import { DEPTS, KIND_TH, LEAVE_TH, STATUS_TH, Kind, LeaveType, LeaveStatus } from "@/lib/types";

type Punch = { kind: Kind; punched_at: string; work_date: string; gps_ok: boolean };
type Leave = { id: string; leave_type: LeaveType; start_date: string; days: number; reason: string; status: LeaveStatus };
type Me = {
  employee: { id: string; name: string; dept: string | null; contact: string | null; email: string | null };
  today: string; lateFrom: string; isWorkday: boolean; punches: Punch[]; leaves: Leave[];
};

const hhmm = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
const thDate = (ymd: string) =>
  new Intl.DateTimeFormat("th-TH", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(new Date(ymd + "T00:00:00Z"));
const post = (url: string, body?: unknown) =>
  fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });

function getPos(): Promise<GeolocationPosition | null> {
  return new Promise((res) => {
    if (!navigator.geolocation) return res(null);
    navigator.geolocation.getCurrentPosition(res, () => res(null), { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
  });
}

const input = "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500";
const label = "mb-1 block text-sm font-medium text-slate-600";

export default function Home() {
  const [me, setMe] = useState<Me | null | "loading">("loading");
  const load = useCallback(async () => {
    const r = await fetch("/api/me", { cache: "no-store" });
    setMe(r.ok ? await r.json() : null);
  }, []);
  useEffect(() => { load(); }, [load]);

  if (me === "loading") return <p className="p-10 text-center text-slate-400">กำลังโหลด…</p>;
  if (!me) return <Login onDone={load} />;
  return <App me={me} reload={load} onLogout={async () => { await post("/api/logout"); setMe(null); }} />;
}

/* ---------------- Login ---------------- */
function Login({ onDone }: { onDone: () => void }) {
  const [list, setList] = useState<{ id: string; name: string }[]>([]);
  const [id, setId] = useState(""); const [pin, setPin] = useState("");
  const [remember, setRemember] = useState(true);
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { fetch("/api/employees").then((r) => r.json()).then((j) => setList(j.employees ?? [])); }, []);

  async function submit() {
    setBusy(true); setErr("");
    const r = await post("/api/login", { employeeId: id, pin, remember });
    if (r.ok) return onDone();
    setErr((await r.json()).error ?? "เข้าสู่ระบบไม่สำเร็จ"); setBusy(false); setPin("");
  }
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-5">
      <div className="relative rounded-3xl bg-white p-6 shadow-xl">
        <SecretTitle className="absolute right-4 top-2 text-[10px] text-slate-300">v{APP_VERSION}</SecretTitle>
        <SecretTitle><h1 className="text-center text-2xl font-bold text-indigo-600">ลงเวลาและลางาน</h1></SecretTitle>
        <p className="mb-6 text-center text-sm text-slate-500">เข้าสู่ระบบครั้งเดียว ใช้ต่อได้ทั้งเดือน</p>
        <label className={label}>ชื่อของคุณ</label>
        <select className={input} value={id} onChange={(e) => setId(e.target.value)}>
          <option value="">-- เลือกชื่อ --</option>
          {list.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <label className={`${label} mt-4`}>รหัส PIN</label>
        <input className={`${input} text-center text-2xl tracking-[0.5em]`} type="password" inputMode="numeric" autoComplete="off"
          maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && id && pin.length >= 3 && submit()} placeholder="••••" />
        <label className="mt-4 flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4" />
          จำอุปกรณ์นี้ไว้ 30 วัน
        </label>
        {err && <p className="mt-3 rounded-lg bg-red-50 p-3 text-center text-sm text-red-600">{err}</p>}
        <button disabled={!id || pin.length < 3 || busy} onClick={submit}
          className="mt-5 w-full rounded-xl bg-indigo-600 py-3.5 text-lg font-bold text-white shadow disabled:opacity-40">
          {busy ? "กำลังตรวจสอบ…" : "เข้าสู่ระบบ"}
        </button>
      </div>
    </main>
  );
}

/* ---------------- Main app ---------------- */
function App({ me, reload, onLogout }: { me: Me; reload: () => void; onLogout: () => void }) {
  const [tab, setTab] = useState<"punch" | "leave" | "history">("punch");
  const pending = me.leaves.filter((l) => l.status === "pending").length;
  const tabs = [["punch", "ลงเวลา"], ["leave", "แจ้งลา"], ["history", pending ? `ประวัติ (${pending})` : "ประวัติ"]] as const;
  return (
    <main className="mx-auto max-w-md pb-24">
      <header className="relative flex items-center justify-between bg-indigo-600 px-5 py-4 text-white">
        <SecretTitle className="absolute right-2 top-0.5 text-[10px] opacity-40">v{APP_VERSION}</SecretTitle>
        <SecretTitle>
          <p className="text-xs text-indigo-200">สวัสดี</p>
          <p className="text-lg font-bold leading-tight">{me.employee.name}</p>
        </SecretTitle>
        <button onClick={onLogout} className="rounded-lg bg-white/15 px-3 py-1.5 text-xs">ออกจากระบบ</button>
      </header>
      <div className="p-4">
        {tab === "punch" && <PunchTab me={me} reload={reload} />}
        {tab === "leave" && <LeaveTab me={me} reload={reload} done={() => setTab("history")} />}
        {tab === "history" && <HistoryTab me={me} />}
      </div>
      <nav className="fixed inset-x-0 bottom-0 mx-auto grid max-w-md grid-cols-3 border-t bg-white">
        {tabs.map(([k, t]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`py-4 text-sm font-semibold ${tab === k ? "text-indigo-600" : "text-slate-400"}`}>{t}</button>
        ))}
      </nav>
    </main>
  );
}

/* ---------------- Punch ---------------- */
function PunchTab({ me, reload }: { me: Me; reload: () => void }) {
  const [busy, setBusy] = useState<Kind | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [needNote, setNeedNote] = useState<Kind | null>(null);
  const [note, setNote] = useState("");

  const today = me.punches.filter((p) => p.work_date === me.today);
  const last = today[today.length - 1]?.kind;
  const primary: Kind = !last || last === "check_out" ? "check_in" : last === "lunch_begin" ? "lunch_end" : "check_out";
  const others = (["check_in", "lunch_begin", "lunch_end", "check_out"] as Kind[]).filter((k) => k !== primary);
  const firstIn = today.find((p) => p.kind === "check_in");
  const isLate = firstIn ? hhmm(firstIn.punched_at) >= me.lateFrom : false;
  const nowT = hhmm(new Date().toISOString());
  const alert: { red: boolean; text: string } | null = !me.isWorkday ? null
    : today.length === 0 ? (nowT >= me.lateFrom
        ? { red: true, text: "⚠️ วันนี้คุณยังไม่ได้ลงเวลาเข้างาน — ถือว่าสายแล้ว กดปุ่มด้านล่างทันที (HR ได้รับรายชื่อผู้ที่ยังไม่ลงเวลา)" }
        : { red: false, text: `อย่าลืมลงเวลาเข้างานก่อน ${me.lateFrom} น.` })
    : firstIn && !today.some((p) => p.kind === "check_out") && nowT >= "17:30"
      ? { red: false, text: "อย่าลืมลงเวลาออกงานก่อนกลับ" } : null;

  async function punch(kind: Kind, withNote?: string) {
    setBusy(kind); setMsg(null);
    const pos = withNote ? null : await getPos();
    if (!pos && !withNote) { setBusy(null); setNeedNote(kind); return; }
    const r = await post("/api/punch", {
      kind, note: withNote, lat: pos?.coords.latitude, lng: pos?.coords.longitude, accuracy: pos?.coords.accuracy,
    });
    const j = await r.json();
    setBusy(null);
    if (!r.ok) return setMsg({ ok: false, text: j.error ?? "บันทึกไม่สำเร็จ" });
    setNeedNote(null); setNote("");
    const warn = j.gps_ok === false ? ` ⚠️ อยู่นอกพื้นที่ทำงาน${j.distance_m ? ` (ห่าง ~${j.distance_m} ม.)` : ""}` : "";
    setMsg({ ok: true, text: `${KIND_TH[kind]} ${j.time} น. บันทึกแล้ว${warn}` });
    reload();
  }

  return (
    <div className="space-y-4">
      <p className="text-center text-sm text-slate-500">วันนี้ {thDate(me.today)}</p>
      {alert && <p className={`rounded-xl p-3 text-center text-sm font-semibold ${alert.red ? "bg-red-100 text-red-700" : "bg-amber-50 text-amber-700"}`}>{alert.text}</p>}
      <button disabled={!!busy} onClick={() => punch(primary)}
        className="flex w-full flex-col items-center rounded-3xl bg-indigo-600 py-10 text-white shadow-xl active:scale-[0.98] disabled:opacity-60">
        <span className="text-4xl font-bold">{busy === primary ? "กำลังระบุตำแหน่ง…" : KIND_TH[primary]}</span>
        <span className="mt-1 text-sm text-indigo-200">แตะครั้งเดียว ระบบจับ GPS และเวลาให้อัตโนมัติ</span>
      </button>

      <div className="grid grid-cols-3 gap-2">
        {others.map((k) => (
          <button key={k} disabled={!!busy} onClick={() => punch(k)}
            className="rounded-xl border border-slate-300 bg-white py-3 text-sm font-medium text-slate-600 disabled:opacity-50">
            {busy === k ? "…" : KIND_TH[k]}
          </button>
        ))}
      </div>

      {needNote && (
        <div className="space-y-2 rounded-2xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm text-amber-800">ไม่พบตำแหน่ง GPS (ตรวจสอบว่าอนุญาตตำแหน่งในเบราว์เซอร์) — ระบุเหตุผลเพื่อบันทึกต่อ</p>
          <input className={input} value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช่น GPS ใช้ไม่ได้ / ทำงานนอกสถานที่" />
          <button disabled={!note.trim()} onClick={() => punch(needNote, note)}
            className="w-full rounded-xl bg-amber-500 py-3 font-bold text-white disabled:opacity-40">บันทึกโดยไม่มี GPS</button>
        </div>
      )}
      {msg && (
        <p className={`rounded-xl p-3 text-center text-sm font-medium ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>{msg.text}</p>
      )}

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-500">
          <span>บันทึกวันนี้</span>
          {isLate && <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700">เข้างานสาย</span>}
        </h2>
        {today.length === 0 && <p className="py-2 text-sm text-slate-400">ยังไม่มีการลงเวลา</p>}
        <ul className="divide-y">
          {today.map((p, i) => (
            <li key={i} className="flex justify-between py-2 text-sm">
              <span>{KIND_TH[p.kind]}</span>
              <span className="font-mono">{hhmm(p.punched_at)} {p.gps_ok ? "" : "⚠️"}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/* ---------------- Leave ---------------- */
function LeaveTab({ me, reload, done }: { me: Me; reload: () => void; done: () => void }) {
  const [f, setF] = useState({
    leave_type: "" as LeaveType | "", start_date: me.today, days: "1", dept: me.employee.dept ?? "",
    contact: me.employee.contact ?? "", email: me.employee.email ?? "", reason: "",
  });
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function submit() {
    setBusy(true); setErr("");
    const r = await post("/api/leave", { ...f, days: Number(f.days) });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) return setErr(j.error ?? "ส่งไม่สำเร็จ");
    reload(); done();
  }
  return (
    <div className="space-y-4">
      <div>
        <label className={label}>ประเภทการลา</label>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(LEAVE_TH) as LeaveType[]).map((k) => (
            <button key={k} onClick={() => set("leave_type", k)}
              className={`rounded-xl border py-3 text-sm font-semibold ${f.leave_type === k ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-300 bg-white text-slate-600"}`}>
              {LEAVE_TH[k]}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={label}>วันที่เริ่มลา</label><input type="date" className={input} value={f.start_date} onChange={(e) => set("start_date", e.target.value)} /></div>
        <div><label className={label}>แผนก</label>
          <select className={input} value={f.dept} onChange={(e) => set("dept", e.target.value)}>
            <option value="">-</option>{DEPTS.map((d) => <option key={d}>{d}</option>)}
          </select></div>
      </div>
      <div>
        <label className={label}>จำนวนวัน</label>
        <div className="flex gap-2">
          {["0.5", "1", "2", "3"].map((d) => (
            <button key={d} onClick={() => set("days", d)}
              className={`flex-1 rounded-xl border py-3 text-sm font-semibold ${f.days === d ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-300 bg-white text-slate-600"}`}>
              {d === "0.5" ? "ครึ่งวัน" : d}
            </button>
          ))}
          <input type="number" min="0.5" step="0.5" className={`${input} !w-20 text-center`} value={f.days} onChange={(e) => set("days", e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={label}>เบอร์โทร / Line</label><input className={input} value={f.contact} onChange={(e) => set("contact", e.target.value)} /></div>
        <div><label className={label}>อีเมล (ถ้ามี)</label><input type="email" className={input} value={f.email} onChange={(e) => set("email", e.target.value)} /></div>
      </div>
      <div><label className={label}>เหตุผลการลา</label><textarea rows={3} className={input} value={f.reason} onChange={(e) => set("reason", e.target.value)} /></div>
      {err && <p className="rounded-lg bg-red-50 p-3 text-center text-sm text-red-600">{err}</p>}
      <button disabled={busy || !f.leave_type} onClick={submit}
        className="w-full rounded-xl bg-indigo-600 py-3.5 text-lg font-bold text-white shadow disabled:opacity-40">
        {busy ? "กำลังส่ง…" : "ส่งใบลา"}
      </button>
      <p className="text-center text-xs text-slate-400">ดูผลการอนุมัติได้ที่แท็บ “ประวัติ”</p>
    </div>
  );
}

/* ---------------- History ---------------- */
const badge: Record<LeaveStatus, string> = {
  pending: "bg-amber-100 text-amber-700", approved: "bg-green-100 text-green-700", denied: "bg-red-100 text-red-600",
};
function HistoryTab({ me }: { me: Me }) {
  const byDay = new Map<string, Punch[]>();
  me.punches.forEach((p) => byDay.set(p.work_date, [...(byDay.get(p.work_date) ?? []), p]));
  const days = [...byDay.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  return (
    <div className="space-y-5">
      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-500">ใบลาของฉัน</h2>
        {me.leaves.length === 0 && <p className="text-sm text-slate-400">ยังไม่มีใบลา</p>}
        <ul className="space-y-2">
          {me.leaves.map((l) => (
            <li key={l.id} className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{LEAVE_TH[l.leave_type]} · {l.days} วัน</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge[l.status]}`}>{STATUS_TH[l.status]}</span>
              </div>
              <p className="text-sm text-slate-500">เริ่ม {thDate(l.start_date)}</p>
              <p className="mt-1 text-sm text-slate-600">{l.reason}</p>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-500">ลงเวลา 14 วันล่าสุด</h2>
        <ul className="divide-y rounded-2xl bg-white shadow-sm">
          {days.map(([d, ps]) => {
            const fin = ps.find((p) => p.kind === "check_in"), fout = [...ps].reverse().find((p) => p.kind === "check_out");
            const late = fin && hhmm(fin.punched_at) >= me.lateFrom;
            return (
              <li key={d} className="flex items-center justify-between px-4 py-3 text-sm">
                <span>{thDate(d)}</span>
                <span className="font-mono">
                  {fin ? hhmm(fin.punched_at) : "--:--"} – {fout ? hhmm(fout.punched_at) : "--:--"}
                  {late && <span className="ml-2 rounded-full bg-orange-100 px-2 py-0.5 font-sans text-xs text-orange-700">สาย</span>}
                </span>
              </li>
            );
          })}
          {days.length === 0 && <li className="p-4 text-sm text-slate-400">ยังไม่มีข้อมูล</li>}
        </ul>
      </section>
    </div>
  );
}
