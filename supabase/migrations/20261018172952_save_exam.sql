-- F3.3 — Wizard buat ujian: simpan draft / terbitkan dalam satu transaksi.
-- save_exam() SECURITY INVOKER: RLS F3.1 tetap berlaku (hanya ujian milik guru, hanya kelas yang
-- diampu); cek di sini hanya untuk pesan error yang jelas (22023 = aman ditampilkan).
-- Peserta = murid kelas terpilih (trigger F3.2) + murid tambahan perorangan.
-- Terbit: wajib ada soal & peserta, token dibuat bila belum ada, notifikasi ke peserta (trigger).
-- ponytail: ujian yang sudah dikerjakan murid tidak bisa diubah sama sekali; edit terbatas
-- (mis. perpanjang jadwal) menyusul bila diminta.

-- Token 6 karakter dari 32 huruf/angka tanpa 0/O/1/I. gen_random_uuid() = acak kriptografis;
-- 6 byte pertama UUID v4 tidak mengandung bit versi. Keunikan & tombol perbarui di F3.4.
create function public.random_exam_token()
returns text
language sql volatile
set search_path = public
as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', get_byte(b, i) % 32 + 1, 1), '')
  from (select uuid_send(gen_random_uuid()) as b) x, generate_series(0, 5) i;
$$;

create function public.save_exam(
  p_id uuid,
  p_subject_id uuid,
  p_title text,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_duration_minutes integer,
  p_kkm numeric,
  p_class_ids uuid[],
  p_student_ids uuid[],
  p_questions jsonb, -- [{question_id, points|null}] sesuai urutan
  p_shuffle_questions boolean,
  p_shuffle_options boolean,
  p_require_fullscreen boolean,
  p_essay_threshold numeric,
  p_score_visibility public.score_visibility,
  p_publish boolean,
  p_max_tab_switches integer default null -- NULL = tanpa auto-submit
)
returns uuid
language plpgsql security invoker
set search_path = public
as $$
declare
  v_year uuid;
  v_exists boolean;
begin
  if my_role() is distinct from 'teacher' or not tenant_is_active() then
    raise exception 'Akses ditolak' using errcode = '42501';
  end if;

  p_title := trim(coalesce(p_title, ''));
  p_class_ids := array(select distinct unnest(coalesce(p_class_ids, '{}')));
  p_student_ids := array(select distinct unnest(coalesce(p_student_ids, '{}')));
  p_questions := coalesce(p_questions, '[]');

  if p_title = '' or length(p_title) > 200 then
    raise exception 'Judul wajib diisi (maks. 200 karakter)' using errcode = '22023';
  end if;
  if p_start_at is null or p_end_at is null or p_end_at <= p_start_at then
    raise exception 'Waktu selesai harus setelah waktu mulai' using errcode = '22023';
  end if;
  if p_duration_minutes is null or p_duration_minutes not between 1 and 600 then
    raise exception 'Durasi harus 1–600 menit' using errcode = '22023';
  end if;
  if p_duration_minutes > extract(epoch from p_end_at - p_start_at) / 60 then
    raise exception 'Durasi lebih panjang dari rentang jadwal ujian' using errcode = '22023';
  end if;
  if p_kkm is null or p_kkm not between 0 and 100 then
    raise exception 'KKM harus 0–100' using errcode = '22023';
  end if;
  if p_max_tab_switches is not null and p_max_tab_switches not between 1 and 100 then
    raise exception 'Batas pindah tab harus 1–100' using errcode = '22023';
  end if;
  if p_essay_threshold is null or p_essay_threshold not between 0 and 1 then
    raise exception 'Ambang kemiripan essay harus 0–100%%' using errcode = '22023';
  end if;
  if jsonb_typeof(p_questions) <> 'array' or jsonb_array_length(p_questions) > 200 then
    raise exception 'Maksimal 200 soal per ujian' using errcode = '22023';
  end if;
  if (select count(distinct q ->> 'question_id') <> count(*) from jsonb_array_elements(p_questions) q) then
    raise exception 'Ada soal yang dipilih lebih dari sekali' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_questions) q
    where (q ->> 'points')::numeric not between 0.01 and 1000
  ) then
    raise exception 'Poin soal harus 0,01–1000' using errcode = '22023';
  end if;

  -- RLS: guru hanya melihat ujian miliknya
  select academic_year_id into v_year from exams where id = p_id;
  v_exists := found;
  if v_exists then
    if exists (select 1 from exam_attempts where exam_id = p_id) then
      raise exception 'Ujian sudah dikerjakan murid, tidak bisa diubah' using errcode = '22023';
    end if;
  else
    select id into v_year from academic_years where is_active;
    if not found then
      raise exception 'Belum ada tahun ajaran aktif' using errcode = '22023';
    end if;
  end if;

  if not exists (
    select 1 from teaching_assignments ta join classes c on c.id = ta.class_id
    where ta.teacher_id = auth.uid() and ta.subject_id = p_subject_id and c.academic_year_id = v_year
  ) then
    raise exception 'Anda tidak mengampu mapel ini' using errcode = '22023';
  end if;
  if exists (
    select unnest(p_class_ids)
    except
    select ta.class_id from teaching_assignments ta join classes c on c.id = ta.class_id
    where ta.teacher_id = auth.uid() and ta.subject_id = p_subject_id and c.academic_year_id = v_year
  ) then
    raise exception 'Ada kelas yang tidak Anda ampu untuk mapel ini' using errcode = '22023';
  end if;
  if (select count(*) from profiles where id = any(p_student_ids) and role = 'student' and is_active)
     <> cardinality(p_student_ids) then
    raise exception 'Ada murid tambahan yang tidak ditemukan atau nonaktif' using errcode = '22023';
  end if;

  if v_exists then
    update exams set
      subject_id = p_subject_id, title = p_title, start_at = p_start_at, end_at = p_end_at,
      duration_minutes = p_duration_minutes, kkm = p_kkm,
      shuffle_questions = p_shuffle_questions, shuffle_options = p_shuffle_options,
      require_fullscreen = p_require_fullscreen, max_tab_switches = p_max_tab_switches,
      essay_threshold = p_essay_threshold, score_visibility = p_score_visibility
    where id = p_id;
  else
    insert into exams (id, academic_year_id, subject_id, title, start_at, end_at, duration_minutes, kkm,
      shuffle_questions, shuffle_options, require_fullscreen, max_tab_switches, essay_threshold, score_visibility)
    values (p_id, v_year, p_subject_id, p_title, p_start_at, p_end_at, p_duration_minutes, p_kkm,
      p_shuffle_questions, p_shuffle_options, p_require_fullscreen, p_max_tab_switches, p_essay_threshold,
      p_score_visibility);
  end if;

  -- Kelas (trigger F3.2 menambah/menghapus murid kelasnya dari peserta)
  delete from exam_classes where exam_id = p_id and class_id <> all(p_class_ids);
  insert into exam_classes (exam_id, class_id)
  select p_id, unnest(p_class_ids)
  on conflict do nothing;

  -- Murid tambahan: yang tidak dipilih lagi & bukan murid kelas terpilih dihapus
  delete from exam_participants ep
  where ep.exam_id = p_id
    and ep.student_id <> all(p_student_ids)
    and not exists (
      select 1 from exam_classes ec join class_students cs on cs.class_id = ec.class_id
      where ec.exam_id = p_id and cs.student_id = ep.student_id
    );
  insert into exam_participants (exam_id, student_id)
  select p_id, unnest(p_student_ids)
  on conflict do nothing;

  delete from exam_questions where exam_id = p_id;
  insert into exam_questions (exam_id, question_id, order_no, points)
  select p_id, (q ->> 'question_id')::uuid, ord, (q ->> 'points')::numeric
  from jsonb_array_elements(p_questions) with ordinality t(q, ord);

  if p_publish then
    if jsonb_array_length(p_questions) = 0 then
      raise exception 'Ujian tanpa soal tidak bisa diterbitkan' using errcode = '22023';
    end if;
    if not exists (select 1 from exam_participants where exam_id = p_id) then
      raise exception 'Ujian belum punya peserta: pilih kelas atau murid' using errcode = '22023';
    end if;
    if p_end_at <= now() then
      raise exception 'Jadwal ujian sudah lewat' using errcode = '22023';
    end if;
  end if;

  -- Status terakhir: notifikasi (trigger) dikirim setelah peserta lengkap
  update exams set
    status = case when p_publish then 'published' else 'draft' end::exam_status,
    access_token = case when p_publish then coalesce(access_token, random_exam_token()) else access_token end,
    published_at = case when p_publish then coalesce(published_at, now()) end
  where id = p_id;

  return p_id;
end;
$$;

revoke execute on function public.random_exam_token() from public, anon;
grant execute on function public.random_exam_token() to authenticated;
revoke execute on function public.save_exam(uuid, uuid, text, timestamptz, timestamptz, integer, numeric,
  uuid[], uuid[], jsonb, boolean, boolean, boolean, numeric, public.score_visibility, boolean, integer)
  from public, anon;
grant execute on function public.save_exam(uuid, uuid, text, timestamptz, timestamptz, integer, numeric,
  uuid[], uuid[], jsonb, boolean, boolean, boolean, numeric, public.score_visibility, boolean, integer)
  to authenticated;

-- Notifikasi "ujian baru" ke peserta saat draft → terbit. dedup_key: terbit ulang tidak dobel.
-- ponytail: murid yang masuk kelas setelah ujian terbit tidak dapat notifikasi (tetap jadi peserta).
create function public.notify_exam_published()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into notifications (tenant_id, user_id, type, title, body, link, dedup_key)
  select new.tenant_id, ep.student_id, 'exam_published', 'Ujian baru: ' || new.title,
    s.name || ' · ' || to_char(new.start_at at time zone 'Asia/Jakarta', 'DD/MM/YYYY HH24:MI') || ' WIB',
    '/student/exams', 'exam_published:' || new.id || ':' || ep.student_id
  from exam_participants ep
  join subjects s on s.id = new.subject_id
  where ep.exam_id = new.id
  on conflict (dedup_key) do nothing;
  return null;
end;
$$;

create trigger exams_notify_published
  after update of status on public.exams
  for each row
  when (old.status = 'draft' and new.status = 'published')
  execute function public.notify_exam_published();

revoke execute on function public.notify_exam_published() from public, anon, authenticated;
