-- F2.3 — Admin Sekolah mengelola akun guru & murid.
-- Akun Auth (email/password, ban) diurus API Route lewat Auth Admin API; baris profiles lewat
-- RPC di bawah, dipanggil dengan sesi Admin Sekolah sehingga trigger audit mencatat actor-nya.
-- SECURITY DEFINER karena RLS profiles tidak memberi user sekolah hak tulis (DEC-011):
-- izin dicek di awal fungsi, tenant SELALU my_tenant(), peran hanya teacher/student.

-- Akun nonaktif kehilangan akses data seketika (JWT lama masih berlaku ±1 jam).
-- Semua policy tenant memakai helper ini, jadi cukup diubah di satu tempat.
create or replace function public.tenant_is_active()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce(
    (select t.status = 'active' and t.active_until > now() and p.is_active
     from profiles p join tenants t on t.id = p.tenant_id
     where p.id = auth.uid()),
    false
  );
$$;

-- Pemanggil = Admin Sekolah aktif; p_id = guru/murid sekolahnya. Mengembalikan peran target.
-- Dipakai juga API Route reset password sebelum memakai service_role.
create function public.managed_user_role(p_id uuid)
returns public.user_role
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_role user_role;
begin
  if my_role() is distinct from 'school_admin' or not tenant_is_active() then
    raise exception 'Tidak diizinkan' using errcode = '42501';
  end if;
  select role into v_role from profiles
  where id = p_id and tenant_id = my_tenant() and role in ('teacher', 'student');
  if not found then
    raise exception 'Akun tidak ditemukan' using errcode = 'P0002';
  end if;
  return v_role;
end;
$$;

-- Dipanggil SETELAH akun Auth dibuat API Route; gagal (mis. NIS duplikat 23505) → API Route
-- menghapus akun Auth tadi.
create function public.create_school_user(
  p_id uuid,
  p_role public.user_role,
  p_full_name text,
  p_nis_nip text
)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if my_role() is distinct from 'school_admin' or not tenant_is_active() then
    raise exception 'Tidak diizinkan' using errcode = '42501';
  end if;
  if p_role not in ('teacher', 'student') then
    raise exception 'Peran tidak valid' using errcode = '22023';
  end if;
  insert into profiles (id, tenant_id, role, full_name, nis_nip)
  values (p_id, my_tenant(), p_role, trim(p_full_name), nullif(trim(p_nis_nip), ''));
end;
$$;

-- NIS murid tidak bisa diubah: membentuk email login (nis@kode.siswa.local).
-- NIP guru boleh diubah (guru login dengan email).
create function public.update_school_user(p_id uuid, p_full_name text, p_nip text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_role user_role := managed_user_role(p_id);
begin
  update profiles set
    full_name = trim(p_full_name),
    nis_nip = case when v_role = 'teacher' then nullif(trim(p_nip), '') else nis_nip end
  where id = p_id;
end;
$$;

create function public.set_school_user_active(p_id uuid, p_active boolean)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  perform managed_user_role(p_id);
  update profiles set is_active = p_active where id = p_id;
end;
$$;

-- Email guru ada di auth.users (tidak terbaca lewat RLS). Hanya untuk Admin Sekolah, sekolahnya.
create function public.teacher_emails()
returns table (id uuid, email text)
language sql stable security definer
set search_path = public
as $$
  select p.id, u.email::text
  from profiles p join auth.users u on u.id = p.id
  where p.tenant_id = my_tenant() and p.role = 'teacher'
    and my_role() = 'school_admin' and tenant_is_active();
$$;

revoke execute on function
  public.managed_user_role(uuid),
  public.create_school_user(uuid, public.user_role, text, text),
  public.update_school_user(uuid, text, text),
  public.set_school_user_active(uuid, boolean),
  public.teacher_emails()
from public, anon;
grant execute on function
  public.managed_user_role(uuid),
  public.create_school_user(uuid, public.user_role, text, text),
  public.update_school_user(uuid, text, text),
  public.set_school_user_active(uuid, boolean),
  public.teacher_emails()
to authenticated;
