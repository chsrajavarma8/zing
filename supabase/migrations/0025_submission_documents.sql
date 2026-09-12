-- 0025_submission_documents.sql
-- Generic document submission support, used first by the Talent Round
-- (replacing the removed exam engine - req. #3): either an uploaded file or
-- a shareable document link (Google Docs etc.), independent of the
-- Drive-folder+checklist flow the Intermediate/Major rounds already use via
-- drive_folder_url/checklist (left untouched).

alter table public.submissions
  add column document_link_url text,
  add column document_storage_path text,
  add column file_name text,
  add column file_size bigint,
  add column mime_type text;

comment on column public.submissions.document_link_url is
  'Generic shareable document link (any https URL - e.g. Google Docs), used by document-based rounds such as the Talent Round. Distinct from drive_folder_url, which is validated as a Google Drive folder link for the final-project rounds.';
comment on column public.submissions.document_storage_path is
  'Path within the private "team-submissions" storage bucket, when the team uploaded a file instead of (or alongside) a document link.';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'team-submissions',
  'team-submissions',
  false,
  26214400,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/png',
    'image/jpeg'
  ]
)
on conflict (id) do nothing;

-- Same pattern as the "documents"/"id-cards" buckets (0012_storage.sql): no
-- public bucket policy for authenticated/anon roles. All reads/writes go
-- through server routes using the service role, after an app-layer
-- permission check (can_submit_for_team + submission window open).
