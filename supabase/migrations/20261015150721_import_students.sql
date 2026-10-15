-- F2.4 — Import murid dari Excel.
-- File diunggah browser langsung ke bucket privat `imports` (DEC-001), API Route mengunduhnya
-- dengan sesi user (policy di bawah berlaku), mem-parse, lalu menyimpan lewat import_students().

-- Bucket imports ----------------------------------------------------------------
-- Path: {tenant_id}/{user_id}/{nama file}. Hanya pengunggahnya sendiri yang bisa membaca/menghapus.
-- Dipakai juga import soal (F2.14): .xlsx + .zip, maks 5 MB.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'imports', 'imports', false, 5 * 1024 * 1024,
  array['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/zip']
);

create policy imports_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'imports'
    and (storage.foldername(name))[1] = (select public.my_tenant())::text
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and (select public.tenant_is_active())
    and (select public.my_role()) in ('school_admin', 'teacher')
  );

create policy imports_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'imports'
    and (storage.foldername(name))[1] = (select public.my_tenant())::text
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and (select public.tenant_is_active())
  );

create policy imports_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'imports'
    and (storage.foldername(name))[1] = (select public.my_tenant())::text
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and (select public.tenant_is_active())
  );

-- import_students ---------------------------------------------------------------
-- Dipanggil API Route SETELAH semua akun Auth dibuat. Semua profil + keanggotaan kelas dalam
-- satu transaksi: satu baris gagal (NIS dobel, kelas sekolah lain, dst.) = tidak ada yang tersimpan,
-- lalu API Route menghapus akun Auth yang sudah dibuat.
-- p_rows: [{"id": uuid, "full_name": text, "nis": text, "class_id": uuid|null}, ...]

create function public.import_students(p_rows jsonb)
returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if my_role() is distinct from 'school_admin' or not tenant_is_active() then
    raise exception 'Tidak diizinkan' using errcode = '42501';
  end if;

  insert into profiles (id, tenant_id, role, full_name, nis_nip)
  select (r ->> 'id')::uuid, my_tenant(), 'student', trim(r ->> 'full_name'), trim(r ->> 'nis')
  from jsonb_array_elements(p_rows) r;
  get diagnostics v_count = row_count;

  -- tenant_id & academic_year_id diisi trigger dari kelas; kelas sekolah lain → FK komposit
  -- (student_id, tenant_id) gagal karena tenant murid ≠ tenant kelas.
  insert into class_students (class_id, student_id)
  select (r ->> 'class_id')::uuid, (r ->> 'id')::uuid
  from jsonb_array_elements(p_rows) r
  where r ->> 'class_id' is not null;

  return v_count;
end;
$$;

revoke execute on function public.import_students(jsonb) from public, anon;
grant execute on function public.import_students(jsonb) to authenticated;
