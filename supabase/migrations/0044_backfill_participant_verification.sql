-- 0044_backfill_participant_verification.sql
-- Data correction for BUG-005. Until the application fix shipped with 0043,
-- the "mark me verified" write after a participant set their private
-- password ran as the participant and was silently reverted by
-- protect_team_member_fields, so NO participant was ever marked verified.
--
-- Backfills exactly the rows the old code tried to update: members linked to
-- an account that has already finished the mandatory password change
-- (must_change_password = false). Rows still on a temporary password, and
-- unlinked rows, are left pending. Idempotent: re-running changes nothing.
-- Must run BEFORE the new application code is live (invitation-created
-- accounts also start with must_change_password = false but are marked
-- verified by the application only once they set a password).
-- protect_team_member_fields only lets the service role / event admins change
-- verification_status; claim the service role for THIS transaction only.
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

update public.team_members tm
set verification_status = 'verified',
    verified_at = coalesce(tm.verified_at, now())
from public.profiles p
where p.id = tm.profile_id
  and p.must_change_password = false
  and tm.verification_status = 'pending';
