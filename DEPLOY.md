# Production launch checklist

## 1. Supabase (database)

Run in [SQL Editor](https://supabase.com/dashboard/project/vepgivwmulpdacsfucmn/sql/new):

- **Admin can't access `/admin`?** Run `supabase/fix-admin-now.sql` first (grants `has_role` + admin role).
- **Support tab empty / error?** Run `supabase/fix-tickets-now.sql` (creates ticket tables + priority trigger).
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

The dashboard toggle alone is **not enough** — Supabase must store both **Client ID** and **Client Secret**.

### Google Cloud Console

1. [Credentials](https://console.cloud.google.com/apis/credentials) → OAuth 2.0 Client ID → **Web application**
2. **Authorized redirect URI** (exact, no wildcards):

   `https://vepgivwmulpdacsfucmn.supabase.co/auth/v1/callback`

3. Copy **Client ID** and **Client Secret** (create a new secret if the old one was lost)

### Supabase Dashboard

1. [Google provider](https://supabase.com/dashboard/project/vepgivwmulpdacsfucmn/auth/providers?provider=Google)
2. Enable Google, paste **Client ID** and **Client Secret** (not just “Authorized Client IDs”), **Save**
3. [URL Configuration](https://supabase.com/dashboard/project/vepgivwmulpdacsfucmn/auth/url-configuration): Site URL `https://upwatch.online`, redirect `https://upwatch.online/**`

### If dashboard Save still fails (`missing OAuth secret`)

Use the Management API script (bypasses a broken dashboard save):

```powershell
# Token: https://supabase.com/dashboard/account/tokens
$env:SUPABASE_ACCESS_TOKEN = "sbp_..."
$env:GOOGLE_CLIENT_ID = "....apps.googleusercontent.com"
$env:GOOGLE_CLIENT_SECRET = "GOCSPX-..."
.\infra\configure-google-oauth.ps1
```

Success = script prints “authorize returns redirect 302”. Then test https://upwatch.online/auth .

## 4. Verify

```powershell
.\infra\verify-apis.ps1
```

Expect green on Kuma, status page, and (after deploy) admin bundle + run-monitors.
