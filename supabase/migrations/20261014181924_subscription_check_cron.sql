-- F1.10 — Cek langganan harian (pg_cron): pengingat H-7/3/1 ke Admin Sekolah + nonaktifkan
-- sekolah yang masa aktifnya lewat. Tabel notifications dibuat sekarang karena dipakai pengingat;
-- UI lonceng & tandai dibaca menyusul di F4.4.
-- ponytail: masa tenggang ujian yang sedang berjalan belum ada (tabel ujian belum ada) → F3.7 (DEC-015).

-- notifications ---------------------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants (id), -- NULL untuk notifikasi Super Admin
  user_id uuid not null references public.profiles (id),
  type text not null, -- misal 'subscription_expiring'
  title text not null,
  body text,
  link text,
  -- Kunci anti-duplikat untuk notifikasi sistem (job harian boleh jalan ulang tanpa dobel)
  dedup_key text unique,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_id_idx on public.notifications (user_id, created_at desc);
create index notifications_tenant_id_idx on public.notifications (tenant_id);

alter table public.notifications enable row level security;

-- Ditulis oleh fungsi sistem (SECURITY DEFINER); update read_at ditambahkan di F4.4.
revoke insert, update, delete on public.notifications from anon, authenticated;

create policy notifications_select_own on public.notifications
  for select to authenticated
  using (
    user_id = (select auth.uid())
    and ((select public.is_super_admin()) or (select public.tenant_is_active()))
  );

-- run_subscription_check ------------------------------------------------------
-- p_now bisa diisi untuk tes dengan tanggal simulasi. Hari dihitung dalam WIB.
-- Aman dijalankan berulang: pengingat tidak dobel di hari yang sama (dedup_key).

create function public.run_subscription_check(p_now timestamptz default now())
returns table (notified int, deactivated int)
language plpgsql security definer
set search_path = public
as $$
declare
  v_today date := (p_now at time zone 'Asia/Jakarta')::date;
  v_notified int;
  v_deactivated int;
begin
  with due as (
    select t.id, t.name, t.active_until,
           (t.active_until at time zone 'Asia/Jakarta')::date - v_today as days_left
    from tenants t
    where t.status = 'active' and t.active_until > p_now
  ), ins as (
    insert into notifications (tenant_id, user_id, type, title, body, link, dedup_key)
    select d.id, p.id, 'subscription_expiring',
           format('Langganan berakhir dalam %s hari', d.days_left),
           format('Masa aktif %s berakhir %s. Hubungi pengelola Ujianku untuk perpanjangan.',
                  d.name, to_char(d.active_until at time zone 'Asia/Jakarta', 'DD-MM-YYYY HH24:MI "WIB"')),
           '/school',
           format('subscription_expiring:%s:%s', p.id, v_today)
    from due d
    join profiles p on p.tenant_id = d.id and p.role = 'school_admin' and p.is_active
    where d.days_left in (7, 3, 1)
    on conflict (dedup_key) do nothing
    returning 1
  )
  select count(*) into v_notified from ins;

  -- Trigger audit mencatat perubahan ini dengan actor NULL (aksi sistem).
  with upd as (
    update tenants set status = 'inactive'
    where status = 'active' and (active_until is null or active_until <= p_now)
    returning 1
  )
  select count(*) into v_deactivated from upd;

  return query select v_notified, v_deactivated;
end;
$$;

-- Hanya dijalankan pg_cron (role postgres), tidak dari aplikasi.
revoke execute on function public.run_subscription_check(timestamptz) from public, anon, authenticated;

-- Jadwal: setiap hari 00:05 WIB = 17:05 UTC (pg_cron memakai UTC).
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('subscription-check', '5 17 * * *', 'select public.run_subscription_check()');
