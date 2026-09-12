-- 0012_storage.sql
-- Private storage buckets. All reads/writes go through server routes using the
-- service role, which issues short-lived signed URLs after an app-layer
-- permission check equivalent to the table RLS policies above. No public
-- bucket policies are defined for authenticated/anon roles on purpose.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('documents', 'documents', false, 26214400, array['application/pdf', 'image/png', 'image/jpeg']),
  ('id-cards', 'id-cards', false, 5242880, array['image/png', 'application/pdf']),
  ('branding', 'branding', true, 5242880, array['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'])
on conflict (id) do nothing;

-- branding bucket is public (event logos etc. displayed on the public site) but
-- only event admins may write to it.
create policy branding_public_read on storage.objects for select
  using (bucket_id = 'branding');

create policy branding_admin_write on storage.objects for insert
  with check (bucket_id = 'branding' and public.is_any_staff());

create policy branding_admin_update on storage.objects for update
  using (bucket_id = 'branding' and public.is_any_staff());

create policy branding_admin_delete on storage.objects for delete
  using (bucket_id = 'branding' and public.is_any_staff());
