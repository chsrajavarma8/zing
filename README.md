# Hackathon Platform

A reusable, production-ready hackathon platform: public marketing site, team registration, a
participant portal, and a role-based admin panel — built on Next.js (App Router) and Supabase
(Postgres, Auth, Storage).

Every event-specific value (name, organizer, dates, prize pool, contact info, rounds, rules,
policies) is configurable from the admin panel — nothing is hardcoded, so the same codebase can
run a future event by editing configuration, not code.

## Stack

- **Next.js 16** (App Router, Turbopack, Server Actions)
- **Supabase**: Postgres + Row Level Security, Auth (email/password, no public signup, participants
  set their own password from an invitation email), Storage
- **shadcn/ui** (Radix primitives) + Tailwind CSS v4
- **Zod** + **react-hook-form** for validation
- **Resend** (optional) for transactional email

## Project structure

```
src/app/(public)/        Public marketing site (home, about, rounds, schedule, rules, prizes, ...)
src/app/login             Email/password sign-in — no public signup
src/app/forgot-password   Static "contact support" help page (no self-serve email recovery)
src/app/auth/set-password Completes an invitation or recovery link (participants, admins, reviewers)
src/app/change-password   Mandatory private-password change for legacy temporary-password accounts
src/app/register          Public team registration
src/app/portal            Participant portal (protected, role: team lead/member)
src/app/admin             Admin panel (protected, role: super_admin/event_admin/reviewer)
src/app/api               Route handlers: registration, signed uploads, document downloads, admin CSV export
src/lib/supabase          Browser / server / admin (service-role) Supabase clients
src/lib/auth              Session + admin role resolution helpers
supabase/migrations       Numbered SQL migrations: schema, RLS policies, functions, storage buckets
supabase/seed.sql         DEV-ONLY demo data (never applied to production)
scripts/                  One-off operator scripts (inviting the first super admin, moving legacy
                          temporary-password participants onto emailed links)
tests/                    unit (npm run test:unit), local-Supabase integration (test:integration), e2e (test:e2e)
```

## Getting started (local development)

### 1. Install dependencies

```bash
npm install
```

### 2. Provision Supabase

Create a Supabase project (via the [dashboard](https://supabase.com/dashboard) or the Vercel
Marketplace integration: `vercel integration add supabase`). Copy `.env.example` to `.env.local`
and fill in:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or the newer `sb_publishable_...` key)
- `SUPABASE_SERVICE_ROLE_KEY` (or the newer `sb_secret_...` key) — **server-only, never expose to the client**
- `POSTGRES_URL` / a direct connection string, if you plan to run the Supabase CLI locally

### 3. Apply database migrations

Using the Supabase CLI (recommended):

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

This runs every file in `supabase/migrations` in order: core schema → teams/participants →
rounds/exams → submissions → judging → notifications → content → requests/feedback → ID
cards/audit log → RLS policies → helper functions → storage buckets → a baseline draft event →
secure admin-invite plumbing.

Alternatively, paste each migration file into the Supabase SQL Editor in numeric order.

For local development with demo data, `npx supabase db reset` also applies `supabase/seed.sql`
(clearly-labeled `[DEV DEMO]` fake records) — this file is **not** run by `db push`, so it never
reaches production.

### 4. Bootstrap the first super admin

```bash
node scripts/invite-super-admin.mjs you@example.com
```

This sends that email a secure link (via Supabase Auth) to set a password. Once they complete it
at `/auth/set-password`, the invite is consumed automatically, granting `super_admin`.

### 5. Configure the event

Sign in at `/admin` and fill in **Event & Branding**: name, organizer, prize pool, dates, contact
info, team size limits. Set **Status** to "Published" once ready — the public site and
registration form only go live for a published event.

### 6. Run the dev server

```bash
npm run dev
```

## Deploying

```bash
npm i -g vercel   # if not already installed
vercel link
vercel env pull .env.local --yes
vercel deploy --prod
```

Set the same environment variables from `.env.example` in the Vercel project settings
(`vercel env add`), plus:

- `NEXT_PUBLIC_SITE_URL` — your production URL (used in ID-card QR codes)
- `RESEND_API_KEY` / `EMAIL_FROM` — optional, enables registration-confirmation and notification email
- `WHATSAPP_PROVIDER` / `WHATSAPP_API_KEY` / `WHATSAPP_API_URL` — optional, enables WhatsApp notification delivery
- `CRON_SECRET` — random string; required for the notification dispatch cron endpoint

Without an email/WhatsApp provider configured, the app degrades honestly: notifications and
registration confirmations are marked "not configured" in the database rather than pretending to
have sent anything.

## Analytics (disabled by default)

`src/lib/analytics.ts` defines a strictly-typed `track()` function for five events: page views,
registration started/completed, submission saved, and categorized form failures. It never accepts
free-form properties — only an explicit allowlisted shape per event — so it's structurally
impossible to pass a participant's name, email, DOB, phone, password, recovery token, or Drive URL
through it.

**No external analytics account has been created and no visitor data is transmitted anywhere.**
`send()` in that file is an empty stub. To actually enable analytics:

1. Choose a privacy-conscious provider (e.g. Plausible, self-hosted PostHog) — organizer decision.
2. Implement `send()` to call that provider's API/beacon.
3. Set `NEXT_PUBLIC_ANALYTICS_ENABLED=true` (and any provider endpoint/key env vars `send()` needs).
4. Update the Privacy Policy from the admin panel to describe the change, since the current
   published text says no analytics/tracking is used.
5. Add a cookie-consent banner for the tracking (see "Cookie consent" below) — none exists today
   because only essential auth-session cookies are currently in use.

## Cookie consent

No cookie-consent banner is shown. This is intentional, not an oversight: the only cookies this
app sets are Supabase Auth's own session cookies, which are strictly necessary for sign-in to
function and are exempt from consent requirements under GDPR/ePrivacy (disclosure in the Privacy
Policy is sufficient — no opt-in needed). There are no third-party scripts, iframes, or tracking
cookies anywhere in the codebase as of this audit. If that changes (analytics above, an embedded
widget, etc.), a consent banner becomes required at that point, not before.

## Security model

- **No public signup.** The app never calls `supabase.auth.signUp()` anywhere.
- **Participants: invitation email, then a private password.** Registration calls
  `inviteParticipant()` (`src/lib/auth/participant-provisioning.ts`), which sends each member a
  Supabase Auth invitation; they set their own password at `/auth/set-password`. No address is
  confirmed on the registrant's behalf and no password is derived from registration details, so
  typing someone else's email into the form grants no access. An email that already has an account
  is linked to the registration only when its owner signs in with a **confirmed** Auth email.
  **Requires working SMTP on the Supabase project** (see `docs/SECURITY-FIXES-2026-09.md`).
- **Legacy temporary passwords.** Accounts created before invitations were introduced used a
  formula password (`src/lib/auth/temp-password.ts`) and are still forced through
  `/change-password` (`profiles.must_change_password`, writable only by the service role). Changing
  it marks the member verified and revokes every other session. Use
  `scripts/reprovision-legacy-participants.mjs` (dry run by default) to move those accounts onto
  emailed recovery links.
- **Admins/reviewers** are invited with a token-bound link (`sendAccountSetupLink()`,
  `acceptAdminInvite()` in `src/lib/auth/provisioning.ts`) completed at `/auth/set-password`, which
  always uses the link's own credentials, never a session already open in the browser.
- **Identity lookups use the verified Auth email** (`auth_user_id_by_email`, service role only);
  `profiles.email` can no longer be changed by users.
- **Organizer-assisted recovery.** `/forgot-password` is a "contact support" page. After verifying
  identity out of band, an organizer uses "Reset access", which emails a recovery link, replaces the
  current password with a random one, and revokes all sessions. It refuses staff accounts.
- **Shared rate limiting** for sign-in and registration is stored in Postgres
  (`rate_limit_hit`, keys SHA-256 hashed), so limits hold across serverless instances.
- **Row Level Security is the source of truth** for every table (see
  `supabase/migrations/0011_rls.sql`); server actions and API routes add a second layer but never
  substitute for it.
- **Service-role key** is used only in `src/lib/supabase/admin.ts` (marked `server-only`) for
  operations that must run ahead of a user having a session (registration, exam grading,
  notification fan-out) — every such call site performs its own authorization check first.
- **Draft judging scores are private** until an admin explicitly publishes them, with separate
  participant vs. public visibility controls and a full audit trail of every score change.
- **Exam answer keys** are never sent to the client; question delivery strips `correct_answer`
  server-side, and exam timing is enforced by the server (`expires_at`), not the browser.

## Known limitations / what to configure before a real event

- Privacy Policy and Terms pages start as clearly-marked **drafts** — have them reviewed (ideally
  by counsel) before launch; edit and publish final versions from **Admin → Content & Policies**.
- Google Drive folder accessibility is **self-declared + manually reviewed**, not automatically
  verified — a saved link doesn't freeze the folder's contents, so review/capture evidence before
  enforcing deadlines strictly.
- WhatsApp delivery requires wiring up a specific provider (Twilio, Gupshup, etc.) — the delivery
  pipeline and "not configured" UI states are in place, but no provider is pre-wired.
- **Scheduled notifications** (Admin → Notifications → "Schedule for later") become visible to
  recipients exactly at their scheduled time. The database releases them (`notification_released`),
  so in-app delivery does not depend on any scheduler, and nothing is readable before that time,
  even through the API. `/api/cron/dispatch-notifications` (Vercel Cron, `vercel.json`) only records
  `sent_at` and sends email-channel copies; set `CRON_SECRET` so it rejects unauthenticated calls.
  The cron runs daily because Vercel Hobby plans allow only daily jobs; on Pro you can change it to
  `*/5 * * * *` if email-channel delivery is re-enabled.
- **Uploads** (team submissions and organizer documents up to 25 MB, logos up to 5 MB) go directly
  from the browser to Supabase Storage through single-use signed URLs. The server then verifies
  each file's real size and file signature before recording it, which avoids Vercel's 4.5 MB
  function request-body limit.
- **Mentor/judge counts** (homepage "15+ mentors" / "8+ judges") are a hardcoded organizer-provided
  fact in `src/lib/event-facts.ts`, not a database-backed roster — there is no admin UI to list
  individual mentors/judges yet. Update that file if the confirmed counts change; wire up a real
  roster (with the "Lineup to be announced" fallback preserved) if named profiles are supplied.
- **Eligibility copy** ("students aged 10 and above... no upper age limit", also in
  `src/lib/event-facts.ts`) reflects a working assumption pending organizer sign-off — see this
  repo's task handoff notes. It intentionally does not enforce an age check anywhere in
  registration; add one only once the organizer confirms exact eligibility rules.
- **School vs. college registration** (`team_members.education_level`, added in migration `0040`):
  school participants provide a class/grade instead of a college roll number. The `prize_tiers` and
  `hero`/`about`/`eligibility` `content_blocks` rows are still only editable via SQL/migration, not
  from the admin panel — same limitation as the Privacy/Terms drafts above, just not yet surfaced in
  Admin → Content & Policies.
