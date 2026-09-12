-- 0004_submissions.sql
-- Final submission: one public Google Drive folder link per team per round.

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  round_id uuid not null references public.rounds(id) on delete cascade,
  drive_folder_url text,
  checklist jsonb not null default '{}'::jsonb,
  public_access_self_confirmed boolean not null default false,
  review_status text not null default 'pending'
    check (review_status in ('pending', 'accessible', 'access_issue', 'accepted')),
  reviewer_notes text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  submitted_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (team_id, round_id)
);

create trigger set_updated_at_submissions before update on public.submissions
  for each row execute function public.set_updated_at();

create table public.submission_history (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  drive_folder_url text,
  changed_by uuid references public.profiles(id),
  note text,
  changed_at timestamptz not null default now()
);

create index submission_history_submission_id_idx on public.submission_history (submission_id);

create function public.log_submission_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.submission_history (submission_id, drive_folder_url, changed_by, note)
  values (new.id, new.drive_folder_url, auth.uid(), 'link updated');
  return new;
end;
$$;

-- Split into two triggers (rather than one function referencing OLD) so the
-- INSERT path never has to touch an unassigned OLD record.
create trigger submissions_history_insert after insert on public.submissions
  for each row execute function public.log_submission_history();

create trigger submissions_history_update after update on public.submissions
  for each row
  when (new.drive_folder_url is distinct from old.drive_folder_url)
  execute function public.log_submission_history();
