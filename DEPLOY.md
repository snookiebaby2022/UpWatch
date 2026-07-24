# Production launch checklist

## 1. Supabase (database)

Run in [SQL Editor](https://supabase.com/dashboard/project/vepgivwmulpdacsfucmn/sql/new):

- Paste and run the full `supabase/setup-complete.sql`, **or**
- Run only `supabase/migrations/20260724213000_ensure_monitors_columns.sql` if the rest is already applied.

This fixes the `interval_seconds` schema error and sets up admin + cron.

## 2. GitHub Actions secrets

Repo → Settings → Secrets and variables → Actions → New repository secret:

| Secret | Where to get it |
|--------|-----------------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare → My Profile → API Tokens → Create (Workers Scripts Edit + Account Read) |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard URL: `dash.cloudflare.com/<account-id>` |
| `SUPABASE_URL` | Supabase → Project Settings → API |
| `SUPABASE_PUBLISHABLE_KEY` | Same |
| `SUPABASE_SERVICE_ROLE_KEY` | Same (server only — never expose client-side) |
| `VITE_SUPABASE_URL` | Same as SUPABASE_URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Same as publishable key |
| `BREVO_API_KEY` | Optional — Brevo → SMTP & API → API Keys |
| `CRON_SECRET` | Optional — any random string |

Then: Actions → **Deploy production** → Run workflow.

## 3. Google OAuth (optional)

Supabase → Authentication → Providers → Google → add redirect URL:

`https://upwatch.online/dashboard`

## 4. Verify

```powershell
.\infra\verify-apis.ps1
```

Expect green on Kuma, status page, and (after deploy) admin bundle + run-monitors.
