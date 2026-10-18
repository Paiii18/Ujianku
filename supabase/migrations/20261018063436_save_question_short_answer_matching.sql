-- F2.10 — save_question menerima Isian (short_answer) & Menjodohkan (matching).
-- Parameter baru p_answers & p_pairs → signature berubah, jadi fungsi lama di-drop lalu dibuat ulang.
-- p_options : PG/BS, sama seperti F2.9.
-- p_answers : isian, jawaban yang diterima ["96", "sembilan puluh enam"]; disimpan apa adanya (trim),
--             dicocokkan nanti setelah normalisasi (huruf kecil, trim, spasi tunggal — F3.11).
-- p_pairs   : menjodohkan, [{"left": "Jakarta", "right": "Indonesia"}, ...] urut tampilan sisi kiri.
--             Baris di-update per position agar id & right_key stabil; right_key acak (default
--             gen_random_uuid) sehingga urutan sisi kanan untuk murid (urut right_key, F3.7) tidak
--             membocorkan pasangan.
-- Data milik tipe lain dibersihkan (opsi / jawaban / pasangan) agar soal selalu konsisten dengan tipenya.

drop function public.save_question(uuid, uuid, public.question_type, text, text, numeric, text, jsonb);

create function public.save_question(
  p_id uuid,
  p_subject_id uuid,
  p_type public.question_type,
  p_content text,
  p_image_path text,
  p_points numeric,
  p_explanation text,
  p_options jsonb default '[]',
  p_answers text[] default '{}',
  p_pairs jsonb default '[]'
)
returns uuid
language plpgsql security invoker
set search_path = public
as $$
declare
  v_choice boolean := p_type in ('multiple_choice', 'true_false');
  v_labels text[];
  v_correct integer;
  v_answers text[];
  v_pairs integer;
  v_folder text := my_tenant() || '/' || p_id || '/';
begin
  if p_type not in ('multiple_choice', 'true_false', 'short_answer', 'matching') then
    raise exception 'Tipe soal ini belum didukung' using errcode = '22023';
  end if;
  if not v_choice then
    p_options := '[]';
  end if;

  -- PG & BS -------------------------------------------------------------------------
  if v_choice then
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
  end if;

  -- Isian ---------------------------------------------------------------------------
  if p_type = 'short_answer' then
    select coalesce(array_agg(trim(a) order by n), '{}') into v_answers
    from unnest(coalesce(p_answers, '{}')) with ordinality as x(a, n);

    if cardinality(v_answers) not between 1 and 10 then
      raise exception 'Isian harus punya 1–10 jawaban yang diterima' using errcode = '22023';
    end if;
    if exists (select 1 from unnest(v_answers) a where length(a) not between 1 and 200) then
      raise exception 'Setiap jawaban diterima harus berisi 1–200 karakter' using errcode = '22023';
    end if;
    if (select count(distinct lower(regexp_replace(a, '\s+', ' ', 'g'))) from unnest(v_answers) a)
       <> cardinality(v_answers) then
      raise exception 'Ada jawaban diterima yang sama' using errcode = '22023';
    end if;
  end if;

  -- Menjodohkan ---------------------------------------------------------------------
  if p_type = 'matching' then
    p_pairs := coalesce(p_pairs, '[]');
    v_pairs := jsonb_array_length(p_pairs);
    if v_pairs not between 2 and 10 then
      raise exception 'Soal menjodohkan harus punya 2–10 pasangan' using errcode = '22023';
    end if;
    if exists (
      select 1 from jsonb_array_elements(p_pairs) p
      where length(trim(coalesce(p ->> 'left', ''))) not between 1 and 500
         or length(trim(coalesce(p ->> 'right', ''))) not between 1 and 500
    ) then
      raise exception 'Setiap pasangan harus berisi teks kiri dan kanan (maks 500 karakter)'
        using errcode = '22023';
    end if;
    -- Teks kembar di satu sisi membuat jawaban murid ambigu
    if (select count(distinct lower(trim(p ->> 'left'))) from jsonb_array_elements(p_pairs) p) <> v_pairs
       or (select count(distinct lower(trim(p ->> 'right'))) from jsonb_array_elements(p_pairs) p) <> v_pairs then
      raise exception 'Teks di sisi kiri maupun kanan tidak boleh sama' using errcode = '22023';
    end if;
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

  insert into questions (id, subject_id, type, content, image_path, points, explanation, accepted_answers)
  values (p_id, p_subject_id, p_type, trim(p_content), nullif(p_image_path, ''), p_points,
          nullif(trim(coalesce(p_explanation, '')), ''), v_answers)
  on conflict (id) do update set
    subject_id = excluded.subject_id,
    type = excluded.type,
    content = excluded.content,
    image_path = excluded.image_path,
    points = excluded.points,
    explanation = excluded.explanation,
    accepted_answers = excluded.accepted_answers;

  -- Opsi (kosong untuk tipe selain PG/BS → semua opsi lama terhapus)
  delete from question_options where question_id = p_id and label <> all (coalesce(v_labels, '{}'));
  insert into question_options (question_id, label, content, image_path, is_correct)
  select p_id, o ->> 'label', trim(coalesce(o ->> 'content', '')),
         nullif(o ->> 'image_path', ''), (o ->> 'is_correct')::boolean
  from jsonb_array_elements(p_options) o
  on conflict (question_id, label) do update set
    content = excluded.content,
    image_path = excluded.image_path,
    is_correct = excluded.is_correct;

  -- Pasangan (position 0, 1, 2, ...; kosong untuk tipe selain menjodohkan)
  if p_type <> 'matching' then
    p_pairs := '[]';
  end if;
  delete from question_pairs where question_id = p_id and position >= jsonb_array_length(p_pairs);
  update question_pairs qp set
    left_text = trim(p.value ->> 'left'),
    right_text = trim(p.value ->> 'right')
  from jsonb_array_elements(p_pairs) with ordinality p(value, n)
  where qp.question_id = p_id and qp.position = p.n - 1;
  insert into question_pairs (question_id, position, left_text, right_text)
  select p_id, p.n - 1, trim(p.value ->> 'left'), trim(p.value ->> 'right')
  from jsonb_array_elements(p_pairs) with ordinality p(value, n)
  where not exists (
    select 1 from question_pairs qp where qp.question_id = p_id and qp.position = p.n - 1
  );

  return p_id;
end;
$$;

revoke execute on function public.save_question(uuid, uuid, public.question_type, text, text, numeric, text, jsonb, text[], jsonb)
  from public, anon;
grant execute on function public.save_question(uuid, uuid, public.question_type, text, text, numeric, text, jsonb, text[], jsonb)
  to authenticated;
