# scripts/build_import.py
"""
One-time cleaner: Google Sheets export (.xlsx) -> data/import.json

Usage:
    python3 scripts/build_import.py path/to/Responses.xlsx path/to/old/index.html

- Reads 'Form Responses 1' (every punch + leave request ever submitted) and 'Leave Records' (approval status).
- Merges spelling variants of the same person, zero-pads PINs ("123" -> "0123"), hashes PINs (scrypt),
  never writes plain PINs to disk.
- Derives work sites from where people actually punched (two clusters found in the data).
- Prints a reconciliation so you can confirm nothing was dropped.
"""
import sys, re, json, math, os, base64, hashlib, statistics, datetime as dt
from collections import Counter, defaultdict
import pandas as pd

XLSX = sys.argv[1]
OLD_HTML = sys.argv[2] if len(sys.argv) > 2 else None
OUT = os.path.join(os.path.dirname(__file__), "..", "data", "import.json")

# Same person typed with different spellings over time -> canonical (latest/most common) spelling.
ALIASES = {
    "ศตรรฆ ศรีอ่ำ": "ศตรรฆ อ่ำศรี",
    "สุนทรีย์ พรหมบุตร": "สุนทรีย์ พรมบุตร",
}
KIND = {"Check In": "check_in", "Check Out": "check_out", "Lunch Begin": "lunch_begin", "Lunch End": "lunch_end"}
LEAVE = {"ลาป่วย": "sick", "ลากิจ": "personal", "ลาพักร้อน": "vacation"}
STATUS = {"Pending": "pending", "Approved": "approved", "Denied": "denied"}
DEPTS = {"SA", "SR", "ACC", "Trainee", "Others"}
GPS_RE = re.compile(r"^\s*(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)\s*@")


def canon(s: str) -> str:
    s = re.sub(r"\s+", " ", str(s)).strip()
    return ALIASES.get(s, s)


def hash_pin(pin: str) -> str:
    # Must match src/lib/pin.ts: scrypt$N$r$p$salt$hash (base64)
    salt = os.urandom(16)
    h = hashlib.scrypt(pin.encode(), salt=salt, n=16384, r=8, p=1, dklen=32)
    return "scrypt$16384$8$1$%s$%s" % (base64.b64encode(salt).decode(), base64.b64encode(h).decode())


def hav(a, b, c, d):
    R, p = 6371000, math.pi / 180
    x = math.sin((c - a) * p / 2) ** 2 + math.cos(a * p) * math.cos(c * p) * math.sin((d - b) * p / 2) ** 2
    return 2 * R * math.asin(math.sqrt(x))


def iso_bkk(ts: pd.Timestamp) -> str:
    return ts.strftime("%Y-%m-%dT%H:%M:%S.") + "%03d" % (ts.microsecond // 1000) + "+07:00"


def nn(v):
    return None if v is None or (isinstance(v, float) and math.isnan(v)) or str(v) == "nan" else str(v).strip() or None


raw = pd.read_excel(XLSX, sheet_name="Form Responses 1", dtype=str)
raw["row"] = raw.index + 2  # spreadsheet row number
raw["ts"] = pd.to_datetime(raw["Timestamp"], format="ISO8601")
raw["name"] = raw["ชื่อ-นามสกุล"].map(canon)
raw["pin"] = raw["รหัส PIN"].astype(str).str.replace(r"\.0$", "", regex=True).str.zfill(4)
raw = raw.sort_values("ts")

is_leave = raw["ประเภท"].isin(LEAVE)
att, lv = raw[~is_leave].copy(), raw[is_leave].copy()

# ---- Leave status (only place approvals were recorded) ----
lr = pd.read_excel(XLSX, sheet_name="Leave Records", dtype=str)
lr_by_id = {r.iloc[0]: r for _, r in lr.iterrows() if str(r.iloc[0]).startswith("LEAVE_REQ_")}
lr_noid = [r for _, r in lr.iterrows() if not str(r.iloc[0]).startswith("LEAVE_REQ_")]

# ---- Employees ----
active_names = set()
if OLD_HTML:
    html = open(OLD_HTML, encoding="utf-8").read()
    block = html.split("employees:")[1].split("}")[0]
    old_hash = {canon(n): h for n, h in re.findall(r'"([^"]+)"\s*:\s*"([0-9a-f]{64})"', block)}
    active_names = set(old_hash)
else:
    old_hash = {}

employees = []
mismatch = []
for name, g in raw.groupby("name"):
    pin = g["pin"].mode()[0]
    if name in old_hash:
        # The sheet stored PINs as numbers (leading zeros lost). Find the spelling the old hash actually matches.
        for cand in (pin, pin.lstrip("0") or "0"):
            if hashlib.sha256(cand.encode()).hexdigest() == old_hash[name]:
                pin = cand
                break
        else:
            mismatch.append(name)
    dept_rows = g[g["แผนก"].notna()].sort_values("ts")
    last = dept_rows.iloc[-1] if len(dept_rows) else None
    dept = nn(last["แผนก"]) if last is not None else None
    first_day, last_day = g["ts"].min().date(), g["ts"].max().date()
    active = (name in active_names) if OLD_HTML else True
    employees.append({
        "name": name,
        "pin_hash": hash_pin(pin),
        "dept": dept if dept in DEPTS else None,
        "contact": nn(last["เบอร์โทร / Line"]) if last is not None else None,
        "email": (nn(last["อีเมลแจ้งผล"]) or "").lower() or None if last is not None else None,
        "active": active,
        "started_on": first_day.isoformat(),
        "ended_on": None if active else last_day.isoformat(),
    })

# ---- Sites: two clusters of real punches ----
pts = []
for _, r in att.iterrows():
    m = GPS_RE.match(r["พิกัด GPS และเวลา"])
    pts.append((float(m[1]), float(m[2])) if m else (None, None))
att["lat"], att["lng"] = [p[0] for p in pts], [p[1] for p in pts]
seeds = [(15.2388, 104.8476), (15.2358, 104.8524)]
sites = []
for i, (sa, so) in enumerate(seeds):
    near = att[att.apply(lambda r: r.lat is not None and hav(r.lat, r.lng, sa, so) < 300, axis=1)]
    sites.append({
        "name": "Location %s" % "AB"[i],
        "lat": round(statistics.median(near.lat), 6),
        "lng": round(statistics.median(near.lng), 6),
        "radius_m": 150,
        "active": True,
        "_punches_seen": int(len(near)),
    })

# ---- Punches ----
punches = []
for _, r in att.iterrows():
    lat, lng = r.lat, r.lng
    best = None
    if lat is not None:
        best = min(((hav(lat, lng, s["lat"], s["lng"]), s) for s in sites), key=lambda x: x[0])
    punches.append({
        "employee_name": r["name"],
        "kind": KIND[r["ประเภท"]],
        "punched_at": iso_bkk(r["ts"]),
        "lat": lat, "lng": lng,
        "site_name": best[1]["name"] if best else None,
        "distance_m": int(round(best[0])) if best else None,
        "gps_ok": (best[0] <= best[1]["radius_m"]) if best else False,
        "note": nn(r["รายละเอียด"]),
        "legacy_key": "sheet:%d" % r["row"],
        "legacy_gps": r["พิกัด GPS และเวลา"],
    })

# ---- Leave requests ----
leaves, diffs = [], 0
noid_i = 0
for _, r in lv.iterrows():
    key = r["พิกัด GPS และเวลา"]
    if key.startswith("LEAVE_REQ_"):
        rec = lr_by_id.get(key)
    else:  # very first request, before ids were introduced
        rec = lr_noid[noid_i] if noid_i < len(lr_noid) else None
        noid_i += 1
    status = STATUS.get(str(rec["Status"]).strip(), "pending") if rec is not None else "pending"
    if rec is not None and (nn(rec["จำนวนวัน"]) and float(rec["จำนวนวัน"]) != float(r["จำนวนวัน"])):
        diffs += 1
    leaves.append({
        "employee_name": r["name"],
        "dept": nn(r["แผนก"]) if nn(r["แผนก"]) in DEPTS else None,
        "leave_type": LEAVE[r["ประเภท"]],
        "start_date": pd.to_datetime(r["วันที่เริ่มลา"]).date().isoformat(),
        "days": float(r["จำนวนวัน"]),
        "contact": nn(r["เบอร์โทร / Line"]),
        "email": (nn(r["อีเมลแจ้งผล"]) or "").lower() or None,
        "reason": nn(r["รายละเอียด"]),
        "status": status,
        "requested_at": iso_bkk(r["ts"]),
        "decided_by": "legacy" if status != "pending" else None,
        "legacy_key": "sheet:%d" % r["row"],
        "legacy_id": key if key.startswith("LEAVE_REQ_") else None,
    })

meta = {
    "generated": dt.datetime.now().isoformat(timespec="seconds"),
    "source_rows": int(len(raw)), "punches": len(punches), "leaves": len(leaves),
    "employees": len(employees), "active_employees": sum(e["active"] for e in employees),
    "sites": len(sites),
    "first_punch": punches[0]["punched_at"], "last_punch": punches[-1]["punched_at"],
}
os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump({"meta": meta, "sites": [{k: v for k, v in s.items() if not k.startswith("_")} for s in sites],
           "employees": employees, "punches": punches, "leaves": leaves},
          open(OUT, "w", encoding="utf-8"), ensure_ascii=False)

print("== Reconciliation ==")
print("source rows %d = punches %d + leaves %d -> %s" % (len(raw), len(punches), len(leaves),
      "OK" if len(raw) == len(punches) + len(leaves) else "MISMATCH"))
print("employees %d (active %d, inactive/history-only %d)" % (len(employees), meta["active_employees"], len(employees) - meta["active_employees"]))
print("punch kinds:", dict(Counter(p["kind"] for p in punches)))
print("leave status:", dict(Counter(l["status"] for l in leaves)))
print("sites:", [(s["name"], s["lat"], s["lng"], s["_punches_seen"]) for s in sites])
print("gps_ok share: %.1f%%" % (100 * sum(p["gps_ok"] for p in punches) / len(punches)))
print("old-html hash vs sheet PIN mismatches:", mismatch or "none")
print("leave day-count differences between sheets:", diffs)
print("wrote", os.path.abspath(OUT))
