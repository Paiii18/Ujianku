-- F2.5 — Murid aktif yang belum punya kelas di tahun ajaran tertentu (untuk dialog "Tambah murid").
-- PostgREST tidak bisa "NOT EXISTS" lewat query string, jadi dibungkus fungsi.
-- SECURITY INVOKER: RLS profiles & class_students tetap berlaku (hanya sekolah sendiri).

create function public.students_without_class(p_academic_year_id uuid, p_q text default null)
returns table (id uuid, full_name text, nis_nip text)
language sql stable
set search_path = public
as $$
  select p.id, p.full_name, p.nis_nip
  from profiles p
  where p.role = 'student'
    and p.is_active
    and not exists (
      select 1 from class_students cs
      where cs.student_id = p.id and cs.academic_year_id = p_academic_year_id
    )
    and (
      coalesce(trim(p_q), '') = ''
      or p.full_name ilike '%' || trim(p_q) || '%'
      or p.nis_nip ilike trim(p_q) || '%'
    )
  order by p.nis_nip
  limit 50; -- ponytail: cukup untuk memilih; persempit dengan pencarian
$$;

revoke execute on function public.students_without_class(uuid, text) from public, anon;
grant execute on function public.students_without_class(uuid, text) to authenticated;

-- Default agar client cukup mengirim class_id, student_id, academic_year_id
-- (trigger fill_class_student tetap menimpa keduanya dari data kelas).
alter table public.class_students alter column tenant_id set default public.my_tenant();
