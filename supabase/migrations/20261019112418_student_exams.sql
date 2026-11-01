-- F3.6 — Daftar ujian murid. Murid tidak punya akses langsung ke exams (F3.1), jadi daftar
-- dibaca lewat RPC: hanya ujian terbit di mana ia peserta, tahun ajaran aktif.
-- Kolom sengaja terbatas: tanpa token, soal, atau pengaturan anti-curang.

create function public.my_exams()
returns table (
  id uuid,
  title text,
  subject_name text,
  start_at timestamptz,
  end_at timestamptz,
  duration_minutes smallint,
  attempt_status public.attempt_status -- NULL = belum mulai
)
language sql stable security definer
set search_path = public
as $$
  select e.id, e.title, s.name, e.start_at, e.end_at, e.duration_minutes, a.status
  from exam_participants ep
  join exams e on e.id = ep.exam_id
  join subjects s on s.id = e.subject_id
  join academic_years y on y.id = e.academic_year_id and y.is_active
  left join exam_attempts a on a.exam_id = e.id and a.student_id = ep.student_id and not a.is_voided
  where ep.student_id = auth.uid()
    and e.status = 'published'
    and e.tenant_id = my_tenant()
    and my_role() = 'student'
    and tenant_is_active()
  order by e.start_at, e.title;
$$;

revoke execute on function public.my_exams() from public, anon;
grant execute on function public.my_exams() to authenticated;
