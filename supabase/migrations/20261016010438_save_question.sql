-- F2.9 — save_question: simpan soal + opsinya dalam satu transaksi (buat baru atau ubah).
-- SECURITY INVOKER: RLS F2.7 tetap berlaku — hanya guru pemilik yang bisa menyimpan;
-- id soal milik guru lain → ON CONFLICT DO UPDATE ditolak policy (42501).
-- p_id dibuat browser lebih dulu agar gambar bisa diunggah ke folder {tenant}/{p_id}/ sebelum disimpan.
-- Opsi di-upsert per label (bukan hapus-semua-lalu-isi) agar id opsi tetap stabil untuk jawaban murid.
-- p_options: [{"label": "A", "content": "96", "image_path": null, "is_correct": true}, ...]
-- F2.10/F2.11 menambah tipe lain dengan `create or replace` di migrasi baru.

create function public.save_question(
  p_id uuid,
  p_subject_id uuid,
  p_type public.question_type,
  p_content text,
  p_image_path text,
  p_points numeric,
  p_explanation text,
  p_options jsonb
)
returns uuid
language plpgsql security invoker
set search_path = public
as $$
declare
  v_labels text[];
  v_correct integer;
  v_folder text := my_tenant() || '/' || p_id || '/';
begin
  if p_type not in ('multiple_choice', 'true_false') then
    raise exception 'Tipe soal ini belum didukung' using errcode = '22023';
  end if;

  select coalesce(array_agg(o ->> 'label' order by o ->> 'label'), '{}'),
         count(*) filter (where (o ->> 'is_correct')::boolean)
    into v_labels, v_correct
  from jsonb_array_elements(p_options) o;

  -- PG: 2–5 opsi berurutan A, B, C, ...; BS: tepat A (Benar) & B (Salah)
  if p_type = 'multiple_choice' and (
    cardinality(v_labels) not between 2 and 5
    or v_labels <> (array['A', 'B', 'C', 'D', 'E'])[1:cardinality(v_labels)]
  ) then
    raise exception 'Soal pilihan ganda harus punya 2–5 opsi (A–E)' using errcode = '22023';
  end if;
  if p_type = 'true_false' and v_labels <> array['A', 'B'] then
    raise exception 'Soal benar/salah harus punya opsi A dan B' using errcode = '22023';
  end if;
  if v_correct <> 1 then
    raise exception 'Harus ada tepat satu kunci jawaban' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_options) o
    where trim(coalesce(o ->> 'content', '')) = '' and nullif(o ->> 'image_path', '') is null
  ) then
    raise exception 'Setiap opsi harus berisi teks atau gambar' using errcode = '22023';
  end if;
  -- Gambar hanya dari folder soal ini (bucket question-images, F2.8)
  if exists (
    select 1
    from (
      select nullif(p_image_path, '') as path
      union all
      select nullif(o ->> 'image_path', '') from jsonb_array_elements(p_options) o
    ) x
    where x.path is not null and left(x.path, length(v_folder)) <> v_folder
  ) then
    raise exception 'Path gambar tidak valid' using errcode = '22023';
  end if;

  insert into questions (id, subject_id, type, content, image_path, points, explanation)
  values (p_id, p_subject_id, p_type, trim(p_content), nullif(p_image_path, ''), p_points,
          nullif(trim(coalesce(p_explanation, '')), ''))
  on conflict (id) do update set
    subject_id = excluded.subject_id,
    type = excluded.type,
    content = excluded.content,
    image_path = excluded.image_path,
    points = excluded.points,
    explanation = excluded.explanation;

  delete from question_options where question_id = p_id and label <> all (v_labels);
  insert into question_options (question_id, label, content, image_path, is_correct)
  select p_id, o ->> 'label', trim(coalesce(o ->> 'content', '')),
         nullif(o ->> 'image_path', ''), (o ->> 'is_correct')::boolean
  from jsonb_array_elements(p_options) o
  on conflict (question_id, label) do update set
    content = excluded.content,
    image_path = excluded.image_path,
    is_correct = excluded.is_correct;

  return p_id;
end;
$$;

revoke execute on function public.save_question(uuid, uuid, public.question_type, text, text, numeric, text, jsonb)
  from public, anon;
grant execute on function public.save_question(uuid, uuid, public.question_type, text, text, numeric, text, jsonb)
  to authenticated;
