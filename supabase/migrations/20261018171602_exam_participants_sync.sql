-- F3.2 — Peserta ujian otomatis dari kelas.
--   * Kelas ditambahkan ke ujian      → semua murid kelas itu jadi peserta.
--   * Kelas dihapus dari ujian        → murid kelas itu dihapus dari peserta, kecuali yang
--                                       sudah punya attempt.
--   * Murid masuk / pindah ke kelas   → ikut ujian kelas barunya yang belum selesai (end_at > now()).
-- Tambahan murid perorangan = insert langsung ke exam_participants (RLS owns_exam, F3.1).
-- SECURITY DEFINER: Admin Sekolah yang memasukkan murid ke kelas tidak punya hak tulis peserta;
-- trigger hanya berjalan setelah insert/delete asalnya lolos RLS.

create function public.exam_class_added()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into exam_participants (exam_id, student_id, tenant_id)
  select new.exam_id, cs.student_id, cs.tenant_id
  from class_students cs
  where cs.class_id = new.class_id
  on conflict do nothing;
  return null;
end;
$$;

create trigger exam_classes_add_participants
  after insert on public.exam_classes
  for each row execute function public.exam_class_added();

-- ponytail: murid tambahan perorangan yang kebetulan anggota kelas ini ikut terhapus;
-- tambah kolom sumber (class/manual) bila guru mengeluh
create function public.exam_class_removed()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  delete from exam_participants ep
  using class_students cs
  where ep.exam_id = old.exam_id
    and cs.class_id = old.class_id
    and ep.student_id = cs.student_id
    -- kelas lain di ujian yang sama tidak perlu dicek: murid hanya punya satu kelas per tahun ajaran
    and not exists (
      select 1 from exam_attempts a where a.exam_id = ep.exam_id and a.student_id = ep.student_id
    );
  return null;
end;
$$;

-- Tidak dipicu saat ujian dihapus: peserta ikut terhapus lewat cascade
create trigger exam_classes_remove_participants
  after delete on public.exam_classes
  for each row
  when (pg_trigger_depth() = 0)
  execute function public.exam_class_removed();

-- ponytail: murid keluar/pindah kelas tetap peserta ujian kelas lamanya;
-- hapus otomatis bila sekolah memintanya (hati-hati dengan attempt yang sudah ada)
create function public.class_student_added()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into exam_participants (exam_id, student_id, tenant_id)
  select ec.exam_id, new.student_id, new.tenant_id
  from exam_classes ec
  join exams e on e.id = ec.exam_id
  where ec.class_id = new.class_id
    and e.end_at > now()
  on conflict do nothing;
  return null;
end;
$$;

create trigger class_students_join_exams
  after insert or update of class_id on public.class_students
  for each row execute function public.class_student_added();

revoke execute on function public.exam_class_added(), public.exam_class_removed(),
  public.class_student_added() from public, anon, authenticated;
