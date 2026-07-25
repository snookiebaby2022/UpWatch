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

## 3. Google OAuth

UpWatch uses **Google Identity Services** + `signInWithIdToken` (no Supabase OAuth redirect, so **Client Secret is optional** on hosted Supabase).

### Google Cloud Console

1. [Credentials](https://console.cloud.google.com/apis/credentials) → OAuth 2.0 Client ID → **Web application**
2. **Authorized JavaScript origins** (required):
   - `https://upwatch.online`
   - `https://www.upwatch.online`
   - `http://localhost:5173` (local dev only)
3. Copy the **Client ID** → set `VITE_GOOGLE_CLIENT_ID` in `.env` and rebuild

### Supabase Dashboard

1. [Google provider](https://supabase.com/dashboard/project/vepgivwmulpdacsfucmn/auth/providers?provider=Google) → Enable Google
2. In **Client IDs** (aka Authorized Client IDs), paste your Web Client ID:
   `670259483154-67e6dgusfovkfi2000smjkksrf5n15pt.apps.googleusercontent.com`
   (If other IDs exist, comma-separate — Web ID first.)
3. Enable **Skip nonce check** (required for the Google button flow)
4. [URL Configuration](https://supabase.com/dashboard/project/vepgivwmulpdacsfucmn/auth/url-configuration): Site URL `https://upwatch.online`, redirect `https://upwatch.online/**`

If you see **Unacceptable audience in id_token**, step 2 was not saved — Supabase does not recognize your Google Client ID yet.

**Server fallback (no Supabase Google config needed):** add `SUPABASE_SERVICE_ROLE_KEY` to the Cloudflare Worker, then run `.\infra\enable-google-signin.ps1` (paste `sb_secret_...` from Supabase → Settings → API Keys).

Or run (needs [Supabase PAT](https://supabase.com/dashboard/account/tokens) with Owner role):

```powershell
$env:SUPABASE_ACCESS_TOKEN = "sbp_..."
$env:GOOGLE_CLIENT_ID = "....apps.googleusercontent.com"
.\infra\configure-google-gis.ps1
```

### Legacy OAuth redirect (optional)

If you prefer `signInWithOAuth`, you must save **Client ID + Client Secret** in Supabase (Owner role). Use `infra/configure-google-oauth.ps1` or the dashboard.

## 4. Verify

```powershell
.\infra\verify-apis.ps1
```

Expect green on Kuma, status page, and (after deploy) admin bundle + run-monitors.
