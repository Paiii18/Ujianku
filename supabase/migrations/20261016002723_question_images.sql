-- F2.8 — Bucket privat question-images: gambar soal & opsi.
-- Path: {tenant_id}/{question_id}/{nama file}. Batas ukuran (2 MB) & tipe (JPG/PNG/WebP)
-- ditegakkan Storage API dari pengaturan bucket. Tampil lewat signed URL (bucket privat).
-- Folder question_id boleh belum ada soalnya: import Excel + ZIP (F2.14) mengunggah gambar
-- dengan id soal yang dibuat lebih dulu, baru soalnya disimpan RPC.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'question-images', 'question-images', false, 2 * 1024 * 1024,
  array['image/jpeg', 'image/png', 'image/webp']
);

-- Unggah: guru, ke folder sekolahnya, dan folder soal itu bukan milik guru lain.
create policy question_images_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'question-images'
    and (storage.foldername(name))[1] = (select public.my_tenant())::text
    and (select public.tenant_is_active())
    and (select public.my_role()) = 'teacher'
    and not exists (
      select 1 from public.questions q
      where q.id::text = (storage.foldername(name))[2]
        and q.created_by <> (select auth.uid())
    )
  );

-- Lihat (= membuat signed URL): yang boleh membaca soal (F2.7) — Super Admin, Admin Sekolah &
-- guru sekolah itu. Murid nanti menerima signed URL dari RPC/API ujian (F3.7), bukan dari policy ini.
create policy question_images_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'question-images'
    and (
      (select public.is_super_admin())
      or (
        (storage.foldername(name))[1] = (select public.my_tenant())::text
        and (select public.tenant_is_active())
        and (select public.my_role()) in ('school_admin', 'teacher')
      )
    )
  );

-- Ganti/hapus: hanya pengunggahnya.
-- ponytail: soal dihapus → file gambarnya tertinggal; bersihkan saat butuh (job berkala).
create policy question_images_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'question-images'
    and owner_id = (select auth.uid())::text
    and (select public.tenant_is_active())
  )
  with check (
    bucket_id = 'question-images'
    and owner_id = (select auth.uid())::text
    and (storage.foldername(name))[1] = (select public.my_tenant())::text
  );

create policy question_images_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'question-images'
    and owner_id = (select auth.uid())::text
    and (select public.tenant_is_active())
  );
