# Hackathon Platform

A reusable, production-ready hackathon platform: public marketing site, team registration, a
participant portal, and a role-based admin panel — built on Next.js (App Router) and Supabase
(Postgres, Auth, Storage).

Every event-specific value (name, organizer, dates, prize pool, contact info, rounds, rules,
policies) is configurable from the admin panel — nothing is hardcoded, so the same codebase can
run a future event by editing configuration, not code.

## Stack

- **Next.js 16** (App Router, Turbopack, Server Actions)
- **Supabase**: Postgres + Row Level Security, Auth (email/password, no public signup, participant
  accounts use a server-generated temporary password with no email step), Storage
- **shadcn/ui** (Radix primitives) + Tailwind CSS v4
- **Zod** + **react-hook-form** for validation
- **Resend** (optional) for transactional email

## Project structure

```
src/app/(public)/        Public marketing site (home, about, rounds, schedule, rules, prizes, ...)
src/app/login             Email/password sign-in — no public signup
src/app/forgot-password   Static "contact support" help page (no self-serve email recovery)
src/app/auth/set-password Completes an admin invite/reset link (admins/reviewers only)
src/app/change-password   Mandatory private-password change after first temp-password sign-in
src/app/register          Public team registration
src/app/portal            Participant portal (protected, role: team lead/member)
src/app/admin             Admin panel (protected, role: super_admin/event_admin/reviewer)
src/app/api               Route handlers: registration, document downloads, exam engine, admin CSV export
src/lib/supabase          Browser / server / admin (service-role) Supabase clients
src/lib/auth              Session + admin role resolution helpers
src/lib/exam              Screening-exam grading, shuffling, server-authoritative timing
supabase/migrations       Numbered SQL migrations: schema, RLS policies, functions, storage buckets
supabase/seed.sql         DEV-ONLY demo data (never applied to production)
scripts/                  One-off bootstrap/migration scripts (inviting the first super admin,
                          creating accounts for participants registered before this auth model)
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
- `ID_CARD_SIGNING_SECRET` — random 32+ character string

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
- **Participants: no email step at all.** `provisionParticipantAccount()`
  (`src/lib/auth/participant-provisioning.ts`) creates each participant's Supabase Auth account
  synchronously at registration time with an 11-character temporary password deterministically
  derived from details only they know (first 2 letters of their team name + first 5 letters of
  their own name + date of birth as MMDD, lowercased, padded with `x` if short — see the
  "First-time login instructions" on the sign-in page). Nothing is emailed, logged, or displayed —
  every participant computes their own. `profiles.must_change_password` is set on account creation
  and gates portal access (enforced in `src/app/portal/layout.tsx`, a server component) until the
  participant sets a private password via `/change-password`; a database trigger
  (`protect_must_change_password` in `0016_temp_password_auth.sql`) makes that column writable only
  by the service-role client, so it cannot be cleared from the browser without an actual password
  change going through `completeMandatoryPasswordChange()`. Editing a participant's team name, name,
  or DOB later never touches their password — it's a one-time input at account creation, not
  recomputed. Existing accounts are never reset automatically; `scripts/migrate-temp-passwords.mjs`
  provisions accounts only for already-registered participants who don't have one yet.
- **Admins/reviewers: unchanged, email-link based.** `sendAccountSetupLink()`
  (`src/lib/auth/provisioning.ts`) still sends a real Supabase invite/reset link, completed at
  `/auth/set-password`. The predictable participant formula is never used for admin/reviewer
  accounts, and neither registration nor any password-change path ever writes to
  `platform_roles`/`event_admins`/`admin_invites` — admin privileges are granted exclusively by
  `consume_admin_invites()` matching a real invite row at account-creation time, independent of any
  password.
- **No self-serve recovery.** `/forgot-password` is a static "contact support" page — there is no
  password-reset email or link for participants. An organizer can trigger
  `resetParticipantAccess()` (Admin → Registrations → a team → "Reset access") only after verifying
  the participant's identity out of band; it refuses to run on any account that also holds
  admin/reviewer access.
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
- The in-memory rate limiter (`src/lib/rate-limit.ts`) is per-instance; for a multi-instance
  production deployment, swap it for Upstash Redis (`vercel integration add upstash`).
- **Scheduled notifications** (Admin → Notifications → "Schedule for later") are dispatched by
  `/api/cron/dispatch-notifications`, triggered every 5 minutes by the Vercel Cron job in
  `vercel.json`. This only runs once the app is deployed to Vercel — set `CRON_SECRET` as an
  environment variable (Vercel sets its side of this automatically) so the endpoint rejects
  unauthenticated calls. Locally, or before deployment, scheduled notifications are saved but not
  dispatched.
