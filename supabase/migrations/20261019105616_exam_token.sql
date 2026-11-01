-- F3.4 — Token ujian: unik per ujian + tombol perbarui (guru).
-- Token lama otomatis tidak berlaku: start_attempt (F3.7) mencocokkan token saat ini.

create unique index exams_access_token_key on public.exams (access_token);

-- Ganti F3.3: ulangi sampai token belum dipakai ujian mana pun. SECURITY DEFINER agar cek
-- keunikan melihat ujian semua guru/sekolah (pemanggil tetap hanya mendapat string acak).
-- Index unik tetap pengaman terakhir bila dua token sama dibuat bersamaan.
create or replace function public.random_exam_token()
returns text
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_token text;
begin
  loop
    select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', get_byte(b, i) % 32 + 1, 1), '')
    into v_token
    from (select uuid_send(gen_random_uuid()) as b) x, generate_series(0, 5) i;
    exit when not exists (select 1 from exams where access_token = v_token);
  end loop;
  return v_token;
end;
$$;

-- Guru pemilik memperbarui token ujian yang sudah terbit (mis. token bocor). RLS exams_write
-- memastikan hanya pemilik; ujian guru lain tidak terlihat → "tidak ditemukan".
create function public.refresh_exam_token(p_exam_id uuid)
returns text
language plpgsql security invoker
set search_path = public
as $$
declare
  v_token text := random_exam_token();
begin
  update exams set access_token = v_token
  where id = p_exam_id and status = 'published';
  if not found then
    raise exception 'Ujian tidak ditemukan atau belum terbit' using errcode = '22023';
  end if;
  return v_token;
end;
$$;

revoke execute on function public.refresh_exam_token(uuid) from public, anon;
grant execute on function public.refresh_exam_token(uuid) to authenticated;
