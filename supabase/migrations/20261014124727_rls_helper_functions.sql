-- F1.2 — Fungsi helper RLS.
-- SECURITY DEFINER: fungsi membaca profiles/tenants dengan hak pemilik (postgres),
-- sehingga policy di tabel profiles tidak memanggil dirinya sendiri (rekursi RLS).
-- STABLE: hasil sama selama satu query, jadi Postgres boleh menghitungnya sekali.
-- Di policy, panggil sebagai `(select public.my_tenant())` agar benar-benar dihitung sekali.

create function public.my_tenant()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select tenant_id from profiles where id = auth.uid();
$$;

create function public.my_role()
returns public.user_role
language sql stable security definer
set search_path = public
as $$
  select role from profiles where id = auth.uid();
$$;

create function public.is_super_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce((select role = 'super_admin' from profiles where id = auth.uid()), false);
$$;

-- Tenant user saat ini aktif: status 'active' DAN masa aktif belum lewat.
-- Cek tanggal juga agar akses langsung tertutup walau job pg_cron harian (F1.10) belum jalan.
-- Super Admin / anon → false (policy memakai is_super_admin() sebagai jalur terpisah).
create function public.tenant_is_active()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce(
    (select t.status = 'active' and t.active_until > now()
     from profiles p join tenants t on t.id = p.tenant_id
     where p.id = auth.uid()),
    false
  );
$$;

revoke execute on function public.my_tenant(), public.my_role(), public.is_super_admin(), public.tenant_is_active() from public, anon;
grant execute on function public.my_tenant(), public.my_role(), public.is_super_admin(), public.tenant_is_active() to authenticated;
