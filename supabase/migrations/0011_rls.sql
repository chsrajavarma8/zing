-- 0011_rls.sql
-- Enable Row Level Security on every table and define access policies.
-- Defense in depth: the app also enforces permissions server-side, but RLS
-- is the source of truth so a bug in application code cannot leak data.

alter table public.profiles enable row level security;
alter table public.platform_roles enable row level security;
alter table public.events enable row level security;
alter table public.event_admins enable row level security;
alter table public.registration_fields enable row level security;
alter table public.policy_versions enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.consents enable row level security;
alter table public.rounds enable row level security;
alter table public.exams enable row level security;
alter table public.exam_questions enable row level security;
alter table public.exam_attempts enable row level security;
alter table public.exam_answers enable row level security;
alter table public.exam_qualifications enable row level security;
alter table public.submissions enable row level security;
alter table public.submission_history enable row level security;
alter table public.judging_criteria enable row level security;
alter table public.scores enable row level security;
alter table public.score_audit enable row level security;
alter table public.publications enable row level security;
alter table public.qualification_status enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_recipients enable row level security;
alter table public.documents enable row level security;
alter table public.announcements enable row level security;
alter table public.faqs enable row level security;
alter table public.content_blocks enable row level security;
alter table public.requests enable row level security;
alter table public.request_messages enable row level security;
alter table public.feedback enable row level security;
alter table public.id_cards enable row level security;
alter table public.audit_logs enable row level security;

-- =============================================================================
-- profiles
-- =============================================================================
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or public.is_super_admin() or public.is_any_staff());

create policy profiles_update_self on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy profiles_update_super_admin on public.profiles for update
  using (public.is_super_admin());

-- inserts happen only via the handle_new_user trigger (security definer), no client insert policy.

-- =============================================================================
-- platform_roles - super admin only, both directions
-- =============================================================================
create policy platform_roles_select on public.platform_roles for select
  using (user_id = auth.uid() or public.is_super_admin());

create policy platform_roles_write on public.platform_roles for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- =============================================================================
-- events
-- =============================================================================
create policy events_select_public on public.events for select
  using (status = 'published' or public.is_event_staff(id) or public.is_super_admin());

create policy events_insert on public.events for insert
  with check (public.is_super_admin());

create policy events_update on public.events for update
  using (public.is_super_admin() or public.is_event_admin(id))
  with check (public.is_super_admin() or public.is_event_admin(id));

create policy events_delete on public.events for delete
  using (public.is_super_admin());

-- =============================================================================
-- event_admins - assignment is a platform super admin action only
-- =============================================================================
create policy event_admins_select on public.event_admins for select
  using (user_id = auth.uid() or public.is_event_staff(event_id) or public.is_super_admin());

create policy event_admins_write on public.event_admins for all
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- =============================================================================
-- registration_fields
-- =============================================================================
create policy registration_fields_select on public.registration_fields for select
  using (true);

create policy registration_fields_write on public.registration_fields for all
  using (public.is_event_admin(event_id))
  with check (public.is_event_admin(event_id));

-- =============================================================================
-- policy_versions
-- =============================================================================
create policy policy_versions_select on public.policy_versions for select
  using (is_current or public.is_event_staff(event_id));

create policy policy_versions_write on public.policy_versions for all
  using (public.is_event_admin(event_id))
  with check (public.is_event_admin(event_id));

-- =============================================================================
-- teams
-- =============================================================================
create policy teams_select on public.teams for select
  using (
    public.is_event_staff(event_id)
    or public.is_team_member_of(id)
  );

create policy teams_insert on public.teams for insert
  with check (public.is_event_admin(event_id));

create policy teams_update on public.teams for update
  using (public.is_event_admin(event_id) or public.is_team_lead(id))
  with check (public.is_event_admin(event_id) or public.is_team_lead(id));

create policy teams_delete on public.teams for delete
  using (public.is_event_admin(event_id));

-- =============================================================================
-- team_members
-- =============================================================================
create policy team_members_select on public.team_members for select
  using (
    public.is_event_staff(event_id)
    or profile_id = auth.uid()
    or public.is_team_lead(team_id)
  );

-- event_id must always match the team's real event - otherwise a team lead
-- could insert/relabel a member under an unrelated event's id and pollute
-- that event's registration stats and RLS-scoped visibility.
create policy team_members_insert on public.team_members for insert
  with check (
    (public.is_event_admin(event_id) or public.is_team_lead(team_id))
    and event_id = public.team_event_id(team_id)
  );

create policy team_members_update on public.team_members for update
  using (public.is_event_admin(event_id) or profile_id = auth.uid() or public.is_team_lead(team_id))
  with check (
    (public.is_event_admin(event_id) or profile_id = auth.uid() or public.is_team_lead(team_id))
    and event_id = public.team_event_id(team_id)
  );

create policy team_members_delete on public.team_members for delete
  using (public.is_event_admin(event_id) or public.is_team_lead(team_id));

-- =============================================================================
-- consents
-- =============================================================================
create policy consents_select on public.consents for select
  using (
    exists (select 1 from public.team_members tm where tm.id = team_member_id and tm.profile_id = auth.uid())
    or exists (select 1 from public.team_members tm where tm.id = team_member_id and public.is_event_staff(tm.event_id))
  );

create policy consents_insert on public.consents for insert
  with check (
    exists (select 1 from public.team_members tm where tm.id = team_member_id and tm.profile_id = auth.uid())
    or exists (select 1 from public.team_members tm where tm.id = team_member_id and public.is_event_admin(tm.event_id))
  );

-- =============================================================================
-- rounds / exams / exam_questions
-- =============================================================================
create policy rounds_select on public.rounds for select
  using (
    exists (select 1 from public.events e where e.id = event_id and e.status = 'published')
    or public.is_event_staff(event_id)
  );

create policy rounds_write on public.rounds for all
  using (public.is_event_admin(event_id))
  with check (public.is_event_admin(event_id));

-- exams metadata (title, instructions, duration, window) contains no answer
-- data, so it's safe to expose like rounds - only exam_questions stays staff-only.
create policy exams_select on public.exams for select
  using (
    exists (select 1 from public.events e
      join public.rounds r on r.event_id = e.id
      where r.id = round_id and e.status = 'published')
    or public.is_event_staff(public.round_event_id(round_id))
  );

create policy exams_write on public.exams for all
  using (public.is_event_admin(public.round_event_id(round_id)))
  with check (public.is_event_admin(public.round_event_id(round_id)));

-- exam_questions: staff only via direct table access. Participants receive
-- questions (minus correct_answer) through a server route using the service role.
create policy exam_questions_select on public.exam_questions for select
  using (public.is_event_staff(public.round_event_id((select round_id from public.exams where id = exam_id))));

create policy exam_questions_write on public.exam_questions for all
  using (public.is_event_admin(public.round_event_id((select round_id from public.exams where id = exam_id))))
  with check (public.is_event_admin(public.round_event_id((select round_id from public.exams where id = exam_id))));

-- =============================================================================
-- exam_attempts / exam_answers / exam_qualifications
-- =============================================================================
-- Deliberately NO client insert/update policy on exam_attempts or exam_answers:
-- every write to these two tables goes through /api/exam/* server routes using
-- the service-role client, which enforce eligibility, the exam time window, and
-- server-authoritative expires_at. If we allowed authenticated clients to write
-- here directly, a participant could set their own expires_at via the anon key
-- and grant themselves unlimited exam time - RLS must not permit that even
-- though the UI never does it. Select-only for the owner (+ staff) below.
create policy exam_attempts_select on public.exam_attempts for select
  using (
    exists (select 1 from public.team_members tm where tm.id = team_member_id and tm.profile_id = auth.uid())
    or public.is_event_staff(public.round_event_id((select round_id from public.exams where id = exam_id)))
  );

create policy exam_answers_select on public.exam_answers for select
  using (
    exists (
      select 1 from public.exam_attempts a
      join public.team_members tm on tm.id = a.team_member_id
      where a.id = attempt_id and tm.profile_id = auth.uid()
    )
    or public.is_event_staff(public.round_event_id((select round_id from public.exams e
      join public.exam_attempts a on a.exam_id = e.id where a.id = attempt_id)))
  );

create policy exam_qualifications_select on public.exam_qualifications for select
  using (
    exists (select 1 from public.team_members tm where tm.id = team_member_id and tm.profile_id = auth.uid())
    or public.is_event_staff(public.round_event_id((select round_id from public.exams where id = exam_id)))
  );

create policy exam_qualifications_write on public.exam_qualifications for all
  using (public.is_event_admin(public.round_event_id((select round_id from public.exams where id = exam_id))))
  with check (public.is_event_admin(public.round_event_id((select round_id from public.exams where id = exam_id))));

-- =============================================================================
-- submissions / submission_history
-- =============================================================================
create policy submissions_select on public.submissions for select
  using (
    public.is_team_member_of(team_id)
    or public.is_event_staff(public.team_event_id(team_id))
  );

create policy submissions_insert on public.submissions for insert
  with check (
    (public.is_team_lead(team_id) or public.is_event_admin(public.team_event_id(team_id)))
    and public.round_event_id(round_id) = public.team_event_id(team_id)
  );

create policy submissions_update on public.submissions for update
  using (public.is_team_lead(team_id) or public.is_event_admin(public.team_event_id(team_id)))
  with check (
    (public.is_team_lead(team_id) or public.is_event_admin(public.team_event_id(team_id)))
    and public.round_event_id(round_id) = public.team_event_id(team_id)
  );

create policy submission_history_select on public.submission_history for select
  using (
    exists (select 1 from public.submissions s where s.id = submission_id and (
      public.is_team_member_of(s.team_id) or public.is_event_staff(public.team_event_id(s.team_id))
    ))
  );

-- =============================================================================
-- judging_criteria
-- =============================================================================
create policy judging_criteria_select on public.judging_criteria for select
  using (true);

create policy judging_criteria_write on public.judging_criteria for all
  using (public.is_event_admin(public.round_event_id(round_id)))
  with check (public.is_event_admin(public.round_event_id(round_id)));

-- =============================================================================
-- scores - draft scores are staff-only; participants/public see only published scope
-- =============================================================================
create policy scores_select on public.scores for select
  using (
    public.is_event_staff(public.round_event_id(round_id))
    or (
      public.is_team_member_of(team_id)
      and public.is_scope_published(round_id, 'participant')
    )
    or public.is_scope_published(round_id, 'public')
  );

create policy scores_insert on public.scores for insert
  with check (
    (public.is_reviewer(public.round_event_id(round_id)) and judge_id = auth.uid())
    or public.is_event_admin(public.round_event_id(round_id))
  );

create policy scores_update on public.scores for update
  using (
    (public.is_reviewer(public.round_event_id(round_id)) and judge_id = auth.uid())
    or public.is_event_admin(public.round_event_id(round_id))
  )
  with check (
    (public.is_reviewer(public.round_event_id(round_id)) and judge_id = auth.uid())
    or public.is_event_admin(public.round_event_id(round_id))
  );

create policy score_audit_select on public.score_audit for select
  using (
    exists (select 1 from public.scores s where s.id = score_id and public.is_event_staff(public.round_event_id(s.round_id)))
  );

-- =============================================================================
-- publications - booleans only, safe to read broadly (drives UI visibility)
-- =============================================================================
create policy publications_select on public.publications for select
  using (true);

create policy publications_write on public.publications for all
  using (public.is_event_admin(public.round_event_id(round_id)))
  with check (public.is_event_admin(public.round_event_id(round_id)));

-- =============================================================================
-- qualification_status
-- =============================================================================
create policy qualification_status_select on public.qualification_status for select
  using (
    public.is_event_staff(public.round_event_id(round_id))
    or (public.is_team_member_of(team_id) and public.is_scope_published(round_id, 'participant'))
    or public.is_scope_published(round_id, 'public')
  );

create policy qualification_status_write on public.qualification_status for all
  using (public.is_event_admin(public.round_event_id(round_id)))
  with check (public.is_event_admin(public.round_event_id(round_id)));

-- =============================================================================
-- notifications / notification_recipients
-- =============================================================================
create policy notifications_select on public.notifications for select
  using (
    public.is_event_staff(event_id)
    or exists (select 1 from public.notification_recipients r where r.notification_id = id and r.profile_id = auth.uid())
  );

create policy notifications_write on public.notifications for all
  using (public.is_event_admin(event_id))
  with check (public.is_event_admin(event_id));

create policy notification_recipients_select on public.notification_recipients for select
  using (
    profile_id = auth.uid()
    or exists (select 1 from public.notifications n where n.id = notification_id and public.is_event_staff(n.event_id))
  );

create policy notification_recipients_update_self on public.notification_recipients for update
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

create policy notification_recipients_write_staff on public.notification_recipients for all
  using (exists (select 1 from public.notifications n where n.id = notification_id and public.is_event_admin(n.event_id)))
  with check (exists (select 1 from public.notifications n where n.id = notification_id and public.is_event_admin(n.event_id)));

-- =============================================================================
-- documents / announcements / faqs / content_blocks
-- =============================================================================
create policy documents_select on public.documents for select
  using (is_current or public.is_event_staff(event_id));

create policy documents_write on public.documents for all
  using (public.is_event_admin(event_id))
  with check (public.is_event_admin(event_id));

create policy announcements_select on public.announcements for select
  using (published_at is not null or public.is_event_staff(event_id));

create policy announcements_write on public.announcements for all
  using (public.is_event_admin(event_id))
  with check (public.is_event_admin(event_id));

create policy faqs_select on public.faqs for select
  using (published or public.is_event_staff(event_id));

create policy faqs_write on public.faqs for all
  using (public.is_event_admin(event_id))
  with check (public.is_event_admin(event_id));

create policy content_blocks_select on public.content_blocks for select
  using (true);

create policy content_blocks_write on public.content_blocks for all
  using (public.is_event_admin(event_id))
  with check (public.is_event_admin(event_id));

-- =============================================================================
-- requests / request_messages
-- =============================================================================
create policy requests_select on public.requests for select
  using (public.is_team_member_of(team_id) or public.is_event_staff(event_id));

create policy requests_insert on public.requests for insert
  with check (public.is_team_member_of(team_id) and requester_profile_id = auth.uid());

create policy requests_update on public.requests for update
  using (public.is_event_staff(event_id))
  with check (public.is_event_staff(event_id));

create policy request_messages_select on public.request_messages for select
  using (
    exists (select 1 from public.requests r where r.id = request_id and (
      public.is_team_member_of(r.team_id) or public.is_event_staff(r.event_id)
    ))
  );

create policy request_messages_insert on public.request_messages for insert
  with check (
    sender_profile_id = auth.uid()
    and exists (select 1 from public.requests r where r.id = request_id and (
      public.is_team_member_of(r.team_id) or public.is_event_staff(r.event_id)
    ))
  );

-- =============================================================================
-- feedback
-- =============================================================================
create policy feedback_select on public.feedback for select
  using (profile_id = auth.uid() or public.is_event_staff(event_id));

create policy feedback_insert on public.feedback for insert
  with check (profile_id = auth.uid());

-- =============================================================================
-- id_cards - direct select restricted; public verification goes through
-- the verify_id_card() security-definer RPC only.
-- =============================================================================
create policy id_cards_select on public.id_cards for select
  using (
    exists (select 1 from public.team_members tm where tm.id = team_member_id and tm.profile_id = auth.uid())
    or exists (select 1 from public.team_members tm where tm.id = team_member_id and public.is_event_staff(tm.event_id))
  );

create policy id_cards_write on public.id_cards for all
  using (exists (select 1 from public.team_members tm where tm.id = team_member_id and public.is_event_admin(tm.event_id)))
  with check (exists (select 1 from public.team_members tm where tm.id = team_member_id and public.is_event_admin(tm.event_id)));

-- =============================================================================
-- audit_logs - readable by super admin (all) or event admin (scoped); no client insert.
-- =============================================================================
create policy audit_logs_select on public.audit_logs for select
  using (public.is_super_admin() or (event_id is not null and public.is_event_admin(event_id)));
