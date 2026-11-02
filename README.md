<!-- README.md -->
# Time Attendance & Leave (v3) – Next.js + Supabase on Vercel

Replaces Google Form + Apps Script + Sheets. Staff UI at `/`, admin at `/admin`.

## 1. Supabase (once)
1. Create a project. Dashboard → **SQL Editor** → run `supabase/migrations/001_init.sql`, then `supabase/migrations/002_hr_features.sql`.
2. Project Settings → API: copy the **Project URL** and the **service_role** key (server only!).

## 2. Local setup + import your old data
```bash
npm install
cp .env.example .env.local          # fill in the values (see comments inside)
python3 scripts/build_import.py path/to/Responses.xlsx path/to/old/index.html   # already done once -> data/import.json
npm run import                       # prints a count check; must say "Import verified"
npm run dev                          # http://localhost:3000
```
`data/import.json` holds staff emails/phones and PIN hashes: it is git-ignored. Do not commit it.

## 3. Deploy
Push to GitHub → Vercel → import repo → add the same env vars → Deploy.

## 4. Check the database is locked (anon key must get nothing)
```bash
curl "https://YOUR-PROJECT.supabase.co/rest/v1/employees?select=name" -H "apikey: YOUR_ANON_KEY" -H "Authorization: Bearer YOUR_ANON_KEY"
```
Expected: an error like `permission denied for table employees` (not rows, not even `[]`).

## 5. Cut-over (no data loss)
1. Pick a quiet moment. Re-download the Sheet as .xlsx, re-run `build_import.py` and `npm run import` – it is idempotent (rows are keyed `sheet:<row number>`), so only new rows are added and PINs you have reset are never overwritten.
2. Google Form → Responses → turn off **Accepting responses** so nobody punches into the old system.
3. Send staff the Vercel link. Keep the old Sheet as a read-only archive.

## Changing rules later
- Late time, work days, holidays: `/admin/employees` → Settings.
- Work sites / radius: Supabase → Table Editor → `sites`.

## HR features
- **Leave → HR email:** every new request emails HR (Settings → HR email) with Approve / Deny buttons. The link opens a confirmation page (works without login, token expires in 14 days, scanners that pre-open links cannot approve). The employee is emailed the result if they gave an email. Needs `GMAIL_USER` + `GMAIL_APP_PASSWORD`.
- **No-punch reminders:** `vercel.json` runs `/api/cron/remind` at ~09:30 (no check-in) and ~19:00 (no check-out) Bangkok time on Mon–Sat. Staff with an email get a reminder, HR gets the list. Work days/holidays/leave are respected. Vercel Hobby cron fires "sometime within the scheduled hour" (not to the minute) and allows 2 daily jobs. Needs `CRON_SECRET`. Staff also see a red banner in the app once it is past the late time.
- **HR Dashboard:** `/admin/hr` (also linked from the secret menu): on-time/late/leave %, per-person table, rankings, arrival-time and weekday charts, monthly trend, per-department, CSV export.
- **Secret menu:** triple-click the title or the `v3.0.0` badge (staff app and admin). Admin password required. Version history, PIN hash generator, diagnostics (DB speed, email/cron configured), test email, reminder dry-run, live console log.
