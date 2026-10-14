-- F1.3 — Policy RLS tabel fondasi (tenants, subscriptions, profiles).
-- Pola: Super Admin lewat is_super_admin(); user sekolah hanya tenant sendiri DAN tenant aktif.
-- Tenant nonaktif = 0 baris di semua tabel (halaman "Langganan berakhir" membaca lewat server, F1.11).
-- Pembuatan akun & sekolah lewat API Route + service_role (F1.8, F2.3), jadi user sekolah tidak diberi INSERT/UPDATE.

-- Data fondasi tidak pernah dihapus permanen (nonaktifkan lewat status / is_active).
revoke delete on public.tenants, public.subscriptions, public.profiles from anon, authenticated;

-- tenants ---------------------------------------------------------------------

create policy tenants_select on public.tenants
  for select to authenticated
  using (
    (select public.is_super_admin())
    or (id = (select public.my_tenant()) and (select public.tenant_is_active()))
  );

create policy tenants_insert_super_admin on public.tenants
  for insert to authenticated
  with check ((select public.is_super_admin()));

create policy tenants_update_super_admin on public.tenants
  for update to authenticated
  using ((select public.is_super_admin()))
  with check ((select public.is_super_admin()));

-- subscriptions ---------------------------------------------------------------
-- Admin Sekolah: lihat status langganan sekolahnya. Guru & murid: tidak ada akses.

create policy subscriptions_select on public.subscriptions
  for select to authenticated
  using (
    (select public.is_super_admin())
    or (
      tenant_id = (select public.my_tenant())
      and (select public.tenant_is_active())
      and (select public.my_role()) = 'school_admin'
    )
  );

create policy subscriptions_insert_super_admin on public.subscriptions
  for insert to authenticated
  with check ((select public.is_super_admin()));

create policy subscriptions_update_super_admin on public.subscriptions
  for update to authenticated
  using ((select public.is_super_admin()))
  with check ((select public.is_super_admin()));

-- profiles --------------------------------------------------------------------
-- Admin Sekolah & guru: semua profil di sekolahnya (guru butuh nama murid untuk ujian/koreksi).
-- Murid: hanya profil sendiri.

create policy profiles_select on public.profiles
  for select to authenticated
  using (
    (select public.is_super_admin())
    or (
      tenant_id = (select public.my_tenant())
      and (select public.tenant_is_active())
      and (
        id = (select auth.uid())
        or (select public.my_role()) in ('school_admin', 'teacher')
      )
    )
  );

create policy profiles_insert_super_admin on public.profiles
  for insert to authenticated
  with check ((select public.is_super_admin()));

create policy profiles_update_super_admin on public.profiles
  for update to authenticated
  using ((select public.is_super_admin()))
  with check ((select public.is_super_admin()));
