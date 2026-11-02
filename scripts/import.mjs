// scripts/import.mjs
// One-time (safe to re-run) import of data/import.json into Supabase.
// Run:  npm run import      (needs .env.local with SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first");
const sb = createClient(url, key, { auth: { persistSession: false } });
const data = JSON.parse(readFileSync(new URL("../data/import.json", import.meta.url), "utf8"));

const must = async (label, p) => { const { data: d, error } = await p; if (error) { console.error(label, "FAILED:", error.message); process.exit(1); } return d; };
const chunks = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

// 1) sites + employees (ignoreDuplicates: re-running never overwrites a PIN you reset later)
await must("sites", sb.from("sites").upsert(data.sites, { onConflict: "name", ignoreDuplicates: true }));
await must("employees", sb.from("employees").upsert(data.employees, { onConflict: "name", ignoreDuplicates: true }));
const empId = Object.fromEntries((await must("read employees", sb.from("employees").select("id,name"))).map((e) => [e.name, e.id]));
const siteId = Object.fromEntries((await must("read sites", sb.from("sites").select("id,name"))).map((s) => [s.name, s.id]));

// 2) punches
const punches = data.punches.map(({ employee_name, site_name, ...p }) => ({
  ...p, employee_id: empId[employee_name], site_id: site_name ? siteId[site_name] : null, source: "legacy",
}));
let n = 0;
for (const c of chunks(punches, 500)) {
  await must("punches", sb.from("punches").upsert(c, { onConflict: "legacy_key", ignoreDuplicates: true }));
  process.stdout.write(`\rpunches ${(n += c.length)}/${punches.length}`);
}
console.log();

// 3) leave requests
const leaves = data.leaves.map(({ employee_name, ...l }) => ({ ...l, employee_id: empId[employee_name], source: "legacy" }));
await must("leaves", sb.from("leave_requests").upsert(leaves, { onConflict: "legacy_key", ignoreDuplicates: true }));

// 4) verify against the source file
const count = async (t, f) => { let q = sb.from(t).select("id", { count: "exact", head: true }); if (f) q = f(q); return (await must("count " + t, q)).count ?? 0; };
const got = {
  employees: await count("employees"),
  punches: await count("punches", (q) => q.eq("source", "legacy")),
  leaves: await count("leave_requests", (q) => q.eq("source", "legacy")),
};
const want = { employees: data.meta.employees, punches: data.meta.punches, leaves: data.meta.leaves };
console.table({ expected: want, in_supabase: got });
const ok = got.employees >= want.employees && got.punches === want.punches && got.leaves === want.leaves;
console.log(ok ? "✅ Import verified - nothing lost." : "❌ Counts differ - do not switch over yet.");
process.exit(ok ? 0 : 1);
