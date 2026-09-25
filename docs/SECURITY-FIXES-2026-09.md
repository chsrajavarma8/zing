# Security and integrity fixes: September 2026 audit

Fixes for the "Zing Hackathon Platform: Audit Report" (BUG-001 to BUG-030, RISK-001 to RISK-009)
plus two issues found while fixing them (NEW-001, NEW-002). This covers what changed, how it was
verified locally, and exactly what must happen in production. **Nothing here has been deployed,
applied to the hosted database, or run against real accounts.**

## 0. Urgent, separable hotfix (NEW-002): approval required

`public_scoreboard_teams` (migration 0036) runs with its owner's privileges and is automatically
updatable. With Supabase's legacy default grants, which a project created before the 2025 default
change has, **an anonymous visitor can rename or delete any team shown on the public scoreboard**
through it. This was reproduced locally with hosted-style grants: the anonymous `UPDATE` succeeded,
and deleting a team would cascade to its members.

`docs/hotfix-revoke-view-writes.sql` removes write privileges from every public view. It is
idempotent, and safe with the **current** production code, which only reads views. Run it in the
Supabase SQL editor; the verification query at the end should return no rows. Migrations 0042 and
0043 repeat it.

## 1. Hosted configuration required before the release

| Setting | Where | Value |
|---|---|---|
| Custom SMTP | Auth → Emails → SMTP | A real provider. The default sender only delivers to your Supabase organization's members, so participant invitations would fail (registration reports them as "Needs support"). |
| Redirect URLs | Auth → URL Configuration | Add `https://<production-origin>/auth/set-password**`. Without it, invitation and recovery links land on the Site URL root and can't set a password (observed locally). |
| Site URL | Auth → URL Configuration | `https://<production-origin>` |
| Public sign-up | Auth → Providers → Email | **Disabled**. The app never calls `signUp()`. |
| Email rate limits | Auth → Rate Limits | High enough for registration bursts (each member gets one invitation). |
| Access-token lifetime | Auth → JWT expiry | Default 3600 s is acceptable now that migration 0045 rejects revoked sessions; see §5. |

### Environment variables (Vercel; names only)

| Name | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | unchanged |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | server-only |
| `NEXT_PUBLIC_SITE_URL` | yes | Canonical `https://` origin, **set for Production AND Preview** builds. It's inlined at build time; ID cards on previews show a "test card" warning. |
| `CRON_SECRET` | yes | protects `/api/cron/dispatch-notifications` |
| `RESEND_API_KEY`, `EMAIL_FROM` | for email notifications | scheduled email-channel delivery |
| `RESEND_API_URL` | **never set in production** | test-only override for a local mock |
| `ORPHAN_UPLOAD_MIN_AGE_MINUTES` | optional | default 180 (longer than the 2 h signed-upload lifetime); lower only in tests |
| `ID_CARD_SIGNING_SECRET` | **remove** | never read by any code; ID cards use random, revocable tokens |

### Scheduler (BUG-022)

In-app notifications need **no** scheduler: the database releases them at `scheduled_at`, and open
portal pages pick them up within about a minute. The cron job does two things: scheduled
**email-channel** delivery (and `sent_at` bookkeeping), and deleting orphaned uploads. For the
documented 5-minute granularity choose one:

- **Vercel Pro:** set `"schedule": "*/5 * * * *"` in `vercel.json`. On Hobby, a deploy with a
  sub-daily cron fails, which is why the committed value stays daily.
- **Any plan:** `docs/scheduler/supabase-pg-cron-dispatch.sql` (pg_cron + pg_net; the secret is
  kept in Vault). Run it after deploying.

With only the daily cron, scheduled emails can be sent up to 24 h late; in-app delivery is
unaffected. The notification composer offers only the in-app channel (a product decision made
before the audit, req. #14); the email path serves email-channel notifications and is covered by
tests.

## 2. Deployment sequence

Tested locally: the **old** application build runs against the **new** schema in a degraded but
safe state. Every page loads; registration still works; member add/remove fail with an honest error;
the public scoreboard shows no scores and the portal roster shows only the viewer until the new code
is live. The reverse order (new code, old schema) breaks the portal and registration invitations,
so **migrations go first**, and the window between the two steps should be minutes.

1. *(Optional, now)* Apply the §0 hotfix.
2. Configure §1 (SMTP, redirect URL, sign-up off, env vars). Harmless for the current code.
3. Build the new code as a **Preview** deployment (not yet promoted) and confirm it builds.
4. Back up the database (Dashboard → Database → Backups, or `pg_dump`).
5. Announce a short window, then `npx supabase db push` (applies 0042 → 0045; each runs in its own
   transaction and rolls back fully on error).
6. Promote the preview deployment to production immediately (`vercel promote <deployment-url>`),
   so no rebuild sits in the window.
7. Smoke test: sign in; view `/portal/team` (the roster lists teammates); see the public
   scoreboard; register a disposable team and confirm the invitation arrives; upload a file larger
   than 5 MB in a test round.
8. Schedule the cron (§1).
9. Legacy accounts (§4). Accounts registered **during** the window got formula passwords from the
   old code, and the script covers them too.

### Recovery

- **Migration failure:** the failing migration rolls back; the earlier ones stay applied. The old
  code keeps working (degraded state above). Fix and re-push; don't promote until all four apply.
- **New code misbehaves after promotion:** Vercel Instant Rollback to the previous deployment
  returns to the degraded-but-safe state. Don't roll the database back unless required.
- **Disable session enforcement (0045) only in an emergency:**
  `alter role authenticator reset pgrst.db_pre_request; notify pgrst, 'reload config';`
- **Full database rollback:** restore the step-4 backup. That reintroduces every fixed
  vulnerability, so pair it with the old code.

## 3. Migrations

| File | Purpose | Data changes |
|---|---|---|
| `0042_explicit_data_api_grants.sql` | Explicit grants on **base tables only** (new projects no longer auto-grant them; on a fresh install every query failed). Revokes all write privileges on views (NEW-002). | none |
| `0043_security_integrity_fixes.sql` | Policies, triggers, views, RPCs for BUG-002/006/007/009/012/013/014/016/018/019/023, RISK-002/003; ends by revoking view writes again | none |
| `0044_backfill_participant_verification.sql` | BUG-005: members whose account already finished the password change become `verified` | only those rows; idempotent |
| `0045_enforce_active_session.sql` | RISK-003: rejects access tokens of revoked or expired sessions on every Data API request (PostgREST pre-request hook) and on client Storage writes | none |

**Read-only pre-check** (profiles whose email was changed through the old writable column):

```sql
select p.id from public.profiles p join auth.users u on u.id = p.id
where lower(p.email) <> lower(u.email);
```

**Known residual (low):** the RLS helper predicates (`is_super_admin(uid)`,
`is_team_member_of(tid, uid)`, …) are callable through RPC and answer yes/no questions about
arbitrary UUIDs. They must stay executable because the policies run them as the calling role. The
proper fix is moving them to a non-exposed schema.

## 4. Legacy temporary-password accounts: runbook (approval required)

`scripts/reprovision-legacy-participants.mjs`. It is a dry run unless given `--apply` together with
`--confirm-target <exact project URL>`.

1. `node scripts/reprovision-legacy-participants.mjs --invite-unlinked --revoke-temp-passwords`
   (dry run: prints counts only, sends nothing).
2. Try one small batch: `--revoke-temp-passwords --limit 5 --apply --confirm-target <URL>`.
3. Run the remainder in batches. For each account the script: emails a recovery link to its
   verified Auth address, replaces the password with a random one, revokes all sessions (with 0045,
   old access tokens are rejected at once), and only then marks it done. A failed email leaves the
   account untouched. Rate-limited emails are retried (`--retry-wait-ms`, `--max-retries`). A
   re-run skips completed accounts, and the exit code is 1 if anything failed.
4. `--invite-unlinked` invites registered members who never got an account, once each.

Locally verified on disposable fixtures (`tests/integration/legacy-script.test.mjs`).

## 5. Session revocation (RISK-003): measured behavior

| After… | Refresh token | Old access token: Data API | Old access token: Storage writes |
|---|---|---|---|
| Admin password change alone (no revoke) | rejected (GoTrue) | **accepted until expiry** | **accepted until expiry** |
| `revoke_user_sessions` without 0045 | rejected | **accepted until expiry (≤ 3600 s)** | **accepted** |
| `revoke_user_sessions` with 0045 | rejected | **rejected immediately (401)** | **rejected** |

**Still not covered:** Storage *reads* by a revoked token. There are no client read policies on the
private buckets; branding is public anyway. Realtime isn't used.

## 6. Verification performed (local, disposable environment)

The local Supabase stack ran with a minimal set of services. Emails went to Mailpit or a local mock
provider. The project in `.env.local` was never contacted; every harness refuses non-local hosts.

- **Fresh install** of all 45 migrations and the seed, applied to a public schema recreated with the
  stack's exact original ACLs.
- **Upgrade** from 0001–0041 with hosted-style grants and representative data: row counts unchanged
  except the intended backfill; 22 behavioral checks pass. **Old code against the new schema**
  smoke-tested (§2).
- Suites run against the final code: `test:auth` 8, `test:unit` 13, `test:integration` 24,
  `test:e2e` 22, QR checks in production, preview, and local configurations,
  `test:browser` 27 in **Chrome and Edge**. Plus `npm run lint` (0 errors), `tsc --noEmit`, and the
  default Turbopack `next build`.

## 7. Not verified here

- Anything on the hosted project: SMTP delivery, redirect allow-list, sign-up setting, Vercel plan
  and limits, whether the §0 grants actually exist there (very likely, but unconfirmed).
- Firefox and Safari (not installed); real mobile devices; screen readers.
- Email delivery through the real Resend API (a local mock was used).
