# Swim Fast Event Site — Complete Architecture Map

**Repo:** `TBSammy/swimfast-event`
**Stack:** Next.js 15 (App Router) + Tailwind 4 + Supabase
**Supabase project:** `bahizyziqhdocycjmdhq`
**Schema:** `nt_demo` (shared with admin site's NT Management)
**Deploy:** Vercel auto-deploy from GitHub at `https://swimfast-event.vercel.app`
**Last updated:** 2026-03-24

---

## Key Architecture Decision: Service Role Only

**Every server-side operation uses `service_role` key, bypassing all RLS.** The browser client (`src/lib/supabase/client.ts`) exists but is **never imported anywhere**. All data flows through Next.js API routes or Server Components — the browser never calls Supabase directly via PostgREST.

This means:
- RLS policies on `nt_demo` tables are irrelevant to Swim Fast (they're for admin site auth)
- The API routes ARE the authorization layer
- Enabling RLS on `nt_demo` tables will NOT break Swim Fast (service_role bypasses RLS)
- But if `SUPABASE_SERVICE_ROLE_KEY` is missing in prod, the server client falls back to anon key — which WOULD break if RLS is enabled

---

## Routes & Pages

| Route | Type | DB Queries | Auth Required |
|-------|------|-----------|---------------|
| `/` | Static RSC | None (hardcoded) | No |
| `/program` | SSR, revalidate=60s | nt_entries, nt_relays, nt_campaigns, bio_swimmer_profiles | No |
| `/entries` | SSR, revalidate=60s | nt_entries | No |
| `/results` | SSR, revalidate=30s | nt_entries, nt_relays, nt_campaigns, nt_splits | No |
| `/venue` | Static RSC | None | No |
| `/portal` | Client-side | Via API routes | Portal session |
| `/portal/my-events` | Client-side | Via `/api/swimmers/entries` | Portal session |
| `/portal/bio` | Client-side | Via `/api/swimmers/bio` | Portal session |
| `/recorder` | Client-side | Via `/api/recorder/*` | Passphrase |

---

## API Routes

### Auth Flow (`/api/auth/`)

| Endpoint | Method | Purpose | Tables Read | Tables Written |
|----------|--------|---------|-------------|----------------|
| `/api/auth/find-member` | GET | Search swimmers by name (Find My ID) | `nt_swimmers` | — |
| `/api/auth/register` | POST | Register new swimmer contact | `nt_swimmers`, `member_preferences` | `member_preferences` (INSERT) |
| `/api/auth/send-code` | GET | Lookup contact info (masked) | `nt_swimmers`, `member_preferences`, `nt_contacts` | — |
| `/api/auth/send-code` | POST | Generate & send verification code | `nt_swimmers`, `member_preferences`, `nt_contacts`, `portal_verification_codes` | `portal_verification_codes` (INSERT), `comms_email_log` (INSERT) |
| `/api/auth/verify` | POST | Verify code → create session | `portal_verification_codes`, `nt_swimmers` | `portal_verification_codes` (UPDATE), `portal_sessions` (INSERT) |
| `/api/auth/verify` | GET | Validate existing session | `portal_sessions` (join `nt_swimmers`) | — |

### Swimmer API (`/api/swimmers/`)

| Endpoint | Method | Purpose | Tables Read | Tables Written |
|----------|--------|---------|-------------|----------------|
| `/api/swimmers/bio` | GET | Get swimmer bio | `bio_swimmer_profiles` | — |
| `/api/swimmers/bio` | POST | Save/update bio (session-gated) | `portal_sessions`, `bio_swimmer_profiles` | `bio_swimmer_profiles` (UPSERT) |
| `/api/swimmers/entries` | GET | Get swimmer's entries with timing | `nt_entries`, `nt_campaigns` | — |

### Recorder API (`/api/recorder/`)

| Endpoint | Method | Purpose | Tables Read | Tables Written |
|----------|--------|---------|-------------|----------------|
| `/api/recorder/auth` | POST | Validate passphrase | — | — |
| `/api/recorder/upload` | POST | Upload results file | `nt_entries`, `nt_relays` | `nt_entries` (UPDATE), `nt_relays` (UPDATE), `nt_splits` (DELETE+INSERT), `nt_campaigns` (UPDATE), `nt_import_history` (INSERT) |

---

## Authentication Mechanisms

### 1. Swimmer Portal (email/SMS verification)

```
Swimmer enters Member ID
  → GET /api/auth/send-code (lookup masked contact info)
  → POST /api/auth/send-code (send 6-digit code, 15min expiry)
  → POST /api/auth/verify (match code → create portal_sessions row)
  → Token stored in localStorage as "swimfast_session"
  → Every portal page validates via GET /api/auth/verify?token=X
```

**Rate limiting:** 3 codes/member/hour, 10 codes/IP/hour (bypass for IP `167.179.182.96`)

**"Find My ID" flow:** Search by name → select swimmer → proceed to verification

**Registration flow:** If no contact info found → register email/phone → creates `member_preferences` row with `source='swimfast_register'`

### 2. Announcer Mode (client-side PIN)

- Hardcoded PIN: `41014101` in `src/components/AnnouncerLink.tsx`
- Stored in `localStorage` as `swimfast_announcer=true`
- No server validation — enables bio display in program view

### 3. Recorder (passphrase per-request)

- Passphrase validated against `RECORDER_PASSPHRASE` env var
- No persistent session — passphrase sent with every upload in FormData
- Two-step: validate (`POST /api/recorder/auth`) then upload

---

## nt_demo Tables — Usage by Swim Fast

### `portal_sessions` — Session tokens ⚠️ RLS OFF
- **INSERT:** `/api/auth/verify` POST — creates session on successful code verification
- **SELECT:** `/api/auth/verify` GET — validates token, checks `expires_at`, joins to `nt_swimmers`
- **SELECT:** `/api/swimmers/bio` POST — validates token before allowing bio save
- **Columns used:** `token` (UUID PK, auto-gen), `campaign_id`, `swimmer_id`, `member_id`, `email`, `verified`, `expires_at`, `created_at`
- **All access via service_role** — RLS irrelevant to Swim Fast, but table is exposed to anon via PostgREST if RLS is off

### `portal_verification_codes` — Verification codes ⚠️ RLS OFF
- **INSERT:** `/api/auth/send-code` POST — stores 6-digit code with 15min expiry
- **SELECT:** `/api/auth/send-code` POST — rate limiting (count recent codes per member/IP)
- **SELECT + UPDATE:** `/api/auth/verify` POST — match code, mark `verified_at`
- **Columns used:** `id`, `campaign_id`, `swimmer_id`, `member_id`, `email`, `code`, `ip_address`, `method`, `expires_at`, `sent_at`, `created_at`, `verified_at`
- **All access via service_role**

### `bio_swimmer_profiles` — Swimmer bios ⚠️ RLS OFF
- **SELECT:** `queries.ts → getBioProfiles()` — program page, filtered to `commentator_consent=true`
- **SELECT:** `/api/swimmers/bio` GET — returns profile by swimmer_id (no auth required!)
- **UPSERT:** `/api/swimmers/bio` POST — save bio (requires valid session token)
- **Columns used:** `swimmer_id`, `member_id`, `campaign_id`, `bio_text`, `goals`, `fun_fact`, `years_swimming`, `commentator_consent`, `event_goals` (JSONB), `created_at`, `updated_at`
- **Note:** GET is open — anyone with a swimmer_id can read the bio. POST is session-gated.

### `comms_email_log` — Audit log ⚠️ RLS OFF
- **INSERT only:** `/api/auth/send-code` POST — logs email/SMS sends (fire-and-forget, non-blocking)
- **Columns used:** `campaign_id`, `member_id`, `email`, `email_type`, `sent_successfully`
- **Never read** by Swim Fast (admin may read via separate tooling)

### `nt_swimmers` — Swimmer data (RLS ON, admin-only policies)
- **SELECT:** find-member, register, send-code, verify, program, entries, results
- **Read-only** from Swim Fast perspective

### `nt_entries` — Entry/results data (RLS ON, admin-only policies)
- **SELECT:** entries page, results page, swimmer entries API, recorder upload (matching)
- **UPDATE:** recorder upload (result fields only: `result_time`, `place`, `dq`, `exh`, etc.)

### `nt_relays` — Relay data (RLS ON, admin-only policies)
- **SELECT:** program, results
- **UPDATE:** recorder upload (result fields only)

### `nt_campaigns` — Campaign config (RLS ON, admin-only policies)
- **SELECT:** results (campaign settings), session plan
- **UPDATE:** recorder upload (`has_results` flag)

### `nt_contacts` — Contact info (RLS ON, admin-only policies)
- **SELECT:** send-code (fallback if no member_preferences)

### `nt_splits` — Split times (RLS ON, admin-only policies)
- **SELECT:** results page
- **DELETE + INSERT:** recorder upload (replace splits for updated entries)

### `nt_import_history` — Import audit trail (RLS ON, admin-only policies)
- **INSERT:** recorder upload (log file import)

---

## Environment Variables

| Variable | Required | Side | Purpose |
|----------|----------|------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Both | Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Both | Anon key (browser client exists but unused) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes (prod) | Server | Service role for RLS bypass |
| `SWIMFAST_CAMPAIGN_ID` | Yes | Server | Active campaign UUID (fallback: `0e1e733f-...`) |
| `RECORDER_PASSPHRASE` | Yes (prod) | Server | Recorder auth |
| `GRAPH_TENANT_ID` | Yes (prod) | Server | Azure AD tenant |
| `GRAPH_CLIENT_ID` | Yes (prod) | Server | Azure AD app ID |
| `GRAPH_CLIENT_SECRET` | Yes (prod) | Server | Azure AD secret |
| `GRAPH_EMAIL_FROM` | Yes (prod) | Server | Sender email |
| `CLICKSEND_USERNAME` | Optional | Server | SMS API |
| `CLICKSEND_API_KEY` | Optional | Server | SMS API |

---

## Campaign Filtering

All queries filtered by `CAMPAIGN_ID` from `src/lib/supabase/config.ts`:
```ts
export const CAMPAIGN_ID = process.env.SWIMFAST_CAMPAIGN_ID || '0e1e733f-abe1-47a3-97cb-f00772fa48f4'
```

---

## ISR / Revalidation

| Page | Revalidation | Notes |
|------|-------------|-------|
| `/program` | 60s | Near-live during meet |
| `/entries` | 60s | |
| `/results` | 30s | Faster refresh for live results |
| `/`, `/venue` | Static | No revalidation needed |

---

## Security Implications for RLS Changes

**Safe to enable RLS on `nt_demo` tables because:**
1. Swim Fast uses `service_role` exclusively — bypasses RLS
2. No browser-side PostgREST queries
3. Admin site uses `authenticated` role with `is_admin_or_super_admin()` — existing policies cover this

**Risk:** If `SUPABASE_SERVICE_ROLE_KEY` is ever unset in Vercel prod, the server falls back to anon key. With RLS enabled and no anon policies on nt_demo, the entire site would break. **Mitigation:** The fallback is only for dev convenience — prod has the key set in Vercel env vars.

**What to enable:**
| Table | Recommended RLS | Reason |
|-------|----------------|--------|
| `portal_sessions` | Enable RLS, 0 anon policies | Contains auth tokens. No legitimate anon access needed. |
| `portal_verification_codes` | Enable RLS, 0 anon policies | Contains verification codes + emails. No legitimate anon access needed. |
| `bio_swimmer_profiles` | Enable RLS, anon SELECT where `commentator_consent=true` | Public bio data is intentionally public, but should be gated. Or skip anon policy since Swim Fast uses service_role. |
| `comms_email_log` | Enable RLS, 0 anon policies | Write-only audit table. No legitimate anon read access. |
