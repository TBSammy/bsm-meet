# BSM Meet Site — Claude Instructions

## Project Identity

- **Repo:** `TBSammy/bsm-meet`
- **Stack:** Next.js 15 + Tailwind 4 + Supabase
- **Supabase:** `bahizyziqhdocycjmdhq` — uses `nt_demo` schema (shared with admin site's NT Management)
- **Deploy:** Vercel at `.vercel.app` (no custom domain)
- **Purpose:** Public swimmer-facing event site for Brisbane Southside Masters SC Meet 2025
- **Campaign ID:** `4862b7bb-9958-4d97-8980-0976a8aa52b8`

## Branding

- **Colors:** Primary blue `#3da3e6`, dark purple `#140070`, dark `#191919`
- **Fonts:** Montserrat (headings + body), Libre Baskerville (accent/sub-headlines)
- **Tailwind classes:** `bsm-*` (blue), `purple-*` (dark purple), `dark-*` (neutrals)

## Critical Rules

1. **Run `npx next build` locally before every push** — TS strict mode errors silently block Vercel deploys
2. **Campaign UUID must match** — verify `config.ts` AND Vercel `SWIMFAST_CAMPAIGN_ID` env var = `4862b7bb-9958-4d97-8980-0976a8aa52b8`
3. **This is a PUBLIC site** — no admin version stamp, no admin features
4. **NEVER modify the HY3 parser** without explicit user confirmation — shared across repos

## Architecture

Cloned from `swimfast-event`. Same auth flow, recorder, portal, results architecture. See Swim Fast CLAUDE.md for details.
