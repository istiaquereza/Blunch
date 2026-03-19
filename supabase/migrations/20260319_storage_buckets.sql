-- ============================================================
-- Storage Buckets for image/file uploads
-- ============================================================

-- Create buckets (public for images, keep staff-documents private)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('food-images',      'food-images',      true,  5242880, array['image/jpeg','image/png','image/webp','image/gif']),
  ('asset-images',     'asset-images',     true,  5242880, array['image/jpeg','image/png','image/webp','image/gif']),
  ('logos',            'logos',            true,  5242880, array['image/jpeg','image/png','image/webp','image/gif']),
  ('staff-photos',     'staff-photos',     true,  5242880, array['image/jpeg','image/png','image/webp','image/gif']),
  ('staff-documents',  'staff-documents',  false, 10485760, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do nothing;

-- Enable RLS on storage.objects (may already be enabled)
alter table storage.objects enable row level security;

-- Public READ on public buckets
create policy if not exists "Public read: food-images"
  on storage.objects for select to public
  using (bucket_id = 'food-images');

create policy if not exists "Public read: asset-images"
  on storage.objects for select to public
  using (bucket_id = 'asset-images');

create policy if not exists "Public read: logos"
  on storage.objects for select to public
  using (bucket_id = 'logos');

create policy if not exists "Public read: staff-photos"
  on storage.objects for select to public
  using (bucket_id = 'staff-photos');

-- Authenticated UPLOAD on all buckets
create policy if not exists "Authenticated upload"
  on storage.objects for insert to authenticated
  with check (bucket_id in ('food-images','asset-images','logos','staff-photos','staff-documents'));

-- Authenticated UPDATE (upsert)
create policy if not exists "Authenticated update"
  on storage.objects for update to authenticated
  using (bucket_id in ('food-images','asset-images','logos','staff-photos','staff-documents'));

-- Authenticated DELETE
create policy if not exists "Authenticated delete"
  on storage.objects for delete to authenticated
  using (bucket_id in ('food-images','asset-images','logos','staff-photos','staff-documents'));

-- Staff documents: authenticated read only
create policy if not exists "Authenticated read: staff-documents"
  on storage.objects for select to authenticated
  using (bucket_id = 'staff-documents');
