# Swim Fast — Lessons Learned (22 March 2026)

## #1 — ALWAYS CHECK THE DATA MATCHES THE PROGRAM

**The very first issue** was that the latest HY3 event file (with seeded heats and lanes) had not been loaded. The admin portal showed correct heat/lane data, but the Swim Fast site was empty.

**Root cause:** The HY3 file was reimported into `nt_campaigns`, which created a new campaign with a **new UUID**. The Swim Fast site had the old campaign UUID hardcoded in `config.ts` and in the Vercel `SWIMFAST_CAMPAIGN_ID` env var.

**Lesson:** After any reimport, verify:
1. The campaign UUID in `config.ts` / env vars matches the new campaign
2. The Vercel environment variable is updated (env var takes priority over code fallback)
3. The data on the live site matches what the admin shows

---

## #2 — Campaign Deletion is Blocked by FK Constraints

Deleting a campaign from `nt_campaigns` was extremely painful because multiple tables have `ON DELETE NO ACTION` foreign keys pointing back to it.

### Tables that BLOCK campaign deletion

| Table | FK to `nt_campaigns` | FK to `nt_swimmers` | Contains user data? |
|---|---|---|---|
| `bio_swimmer_profiles` | NO ACTION | NO ACTION | YES — swimmer-submitted bios |
| `comms_email_log` | NO ACTION | NO ACTION | YES — email audit trail |
| `portal_sessions` | NO ACTION | NO ACTION | YES — active login sessions |
| `portal_verification_codes` | NO ACTION | NO ACTION | No — ephemeral OTP codes |
| `nt_relays` | NO ACTION | N/A | No — reimported from HY3 |

### The double FK trap

These tables reference both `campaign_id` AND `swimmer_id`. Since `nt_swimmers` cascades on campaign delete, the `swimmer_id` FK in these tables also blocks the cascade — even if you fix the `campaign_id` FK.

### Proposed fix (not yet implemented)

| Table | `campaign_id` FK | `swimmer_id` FK | Rationale |
|---|---|---|---|
| `nt_relays` | → `CASCADE` | N/A | Reimported data, disposable |
| `bio_swimmer_profiles` | → `SET NULL` | → `SET NULL` | Row survives, re-link via `member_id` |
| `portal_sessions` | → `SET NULL` | → `SET NULL` | Row survives, re-link via `member_id` |
| `comms_email_log` | → `SET NULL` | → `SET NULL` | Audit trail survives, re-link via `recipient_email` |
| `portal_verification_codes` | → `CASCADE` | → `SET NULL` | Ephemeral, safe to delete |

Plus a `transfer_orphaned_data(new_campaign_id)` RPC that re-links orphaned rows by matching on `member_id` after reimport.

**Status:** Not yet implemented. Will hit this again on any future campaign delete/reimport.

---

## #3 — Age vs Age Groups

The site was displaying the swimmer's actual age (e.g. "56") instead of their Masters Swimming age group (e.g. "55-59"). The `age_group` field already existed in `nt_swimmers` — it just wasn't being used.

**Fixed in:** Entry list, program, portal welcome, my-events portal.
`ResultsClient` was already using `age_group`.

---

## #4 — Event Sort Order (Text vs Numeric)

The swimmer portal's "My Events" page sorted events by `event_number` as **text** (Supabase `.order()` on a text column). This produced: 13, 17, 24, 6, 9 instead of 6, 9, 13, 17, 24.

**Fix:** Sort numerically in JS after fetch: `.sort((a, b) => parseInt(a.event_number) - parseInt(b.event_number))`

---

## #5 — Session Start Times vs Per-Event-Heat Times

The portal was showing the session start time (e.g. "3:20 PM") for every event in that session. Two events in the same session showed identical times — not useful for swimmers planning when to be ready.

**Fix:** Ported the admin's `sessionTiming.ts` logic into a shared `computeHeatStartTimes()` function that calculates per-event, per-heat estimated start times based on:
- Slowest seed time in each heat + 45s interval + 15s backstroke extra
- Sequential accumulation across events within a session

Also added **live timing**: once results come in, completed heats use actual result times instead of seeds, showing whether the meet is running ahead or behind schedule (+/- minutes indicator).

---

## #6 — Always Build Locally Before Pushing

A TypeScript strict mode error (`Parameter 'a' implicitly has an 'any' type`) broke the Vercel build. 4 commits were pushed but none deployed — the site stayed stuck on the last successful commit (`9d41f50`) while we kept adding features on top.

**The fix was trivial** (add `: any` type annotations), but it took checking the Vercel deploy status to realise nothing had deployed since the first commit.

**Rule:** Run `npx next build` locally before every push. Catches TS errors, missing imports, and build-time failures before they silently block deployment.

---

## #7 — localStorage Data Doesn't Translate to Other Sites (PATTERN)

The admin portal's Session Planner stores session start times, breaks, and settings in **browser `localStorage`** only — not in the database. Any data stored in localStorage is:
- **Invisible to other sites** — Swim Fast, public site, or any other consumer can't read it
- **Per-browser, per-device** — configuring on one machine doesn't sync to another
- **Lost on cache clear** — one browser reset wipes all configuration

This is a **pattern to watch for across all admin features.** Any admin feature that stores configuration in localStorage instead of the database will have the same problem: the data exists only in that one browser session and cannot be consumed by external sites, APIs, or other users.

### This specific case: Session Planner
- The admin Session Planner calculated session start times and breaks correctly but only saved to localStorage
- The Swim Fast public site was forced to **hardcode** session definitions in `src/lib/sessions.ts` (`SESSION_DEFS`)
- **Breaks between events were not accounted for** — swimmers saw incorrect estimated start times
- **Fix applied:** Added `session_plan` JSONB column to `nt_demo.nt_campaigns`. Admin now auto-saves to DB (debounced). Swim Fast reads from DB. localStorage kept as fast working copy for the admin UI.

### Additional finding: Admin read its own localStorage too
The admin's Program tab (outside the Session Planner) was also reading from localStorage to display event start times. This meant even the admin view was inconsistent across browsers/devices. Fixed to read from `campaign.session_plan` in DB.

**Key principle:** If data is written to DB, everything should READ from DB too — including the same app that wrote it. localStorage should only be used as a fast working cache inside the editor component itself, never as the read source for display views.

### Additional finding: autoStartTime placeholders
Sessions with `autoStartTime: true` stored "09:00" as a placeholder in DB. External consumers (Swim Fast) read "09:00" literally and showed 9:00 AM. Fix: admin resolves computed effective start times from `computedSessions` before writing to DB.

### Audit checklist: What else uses localStorage?
- [ ] Search admin codebase for `localStorage.setItem` / `localStorage.getItem`
- [ ] For each: does this data need to be consumed by another site or user?
- [ ] If yes: persist to DB, keep localStorage as optional cache only

---

## Checklist for Future Meets

- [ ] Load the correct/latest HY3 file with seeded heats and lanes
- [ ] Verify campaign UUID matches in `config.ts` AND Vercel env
- [ ] Check data on live site matches admin portal
- [ ] Implement FK cascade fix before next campaign delete is needed
- [ ] Verify age groups display (not raw ages)
- [ ] Test event sort order with single and double digit event numbers
- [ ] **Run `npx next build` locally before pushing** — catch TS errors before they silently block Vercel
- [ ] Persist session plan to DB so Swim Fast can read it (breaks, session starts, settings)
- [ ] Replace hardcoded `SESSION_DEFS` in Swim Fast with DB-driven session plan
