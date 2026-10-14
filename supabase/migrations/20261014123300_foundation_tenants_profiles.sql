-- F1.1 — Fondasi multi-tenant: enum, tenants, subscriptions, profiles.
-- Policy RLS menyusul di F1.3; sampai saat itu RLS aktif tanpa policy = tidak ada akses
-- untuk anon/authenticated (hanya service_role & postgres).

-- Enum ------------------------------------------------------------------------

create type public.user_role as enum ('super_admin', 'school_admin', 'teacher', 'student');
create type public.tenant_status as enum ('active', 'inactive');
create type public.payment_status as enum ('pending', 'paid', 'cancelled');

-- tenants ---------------------------------------------------------------------

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{3,20}$'),
  name text not null check (length(trim(name)) > 0),
  -- ponytail: sekolah baru nonaktif sampai pembayaran pertama ditandai lunas (F1.9)
  status public.tenant_status not null default 'inactive',
  active_until timestamptz,
  created_at timestamptz not null default now()
);

alter table public.tenants enable row level security;

-- subscriptions ---------------------------------------------------------------

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id),
  -- periode diisi saat ditandai lunas, karena dihitung dari active_until lama (F1.9)
  period_start date,
  period_end date,
  amount numeric(12, 2) not null check (amount >= 0),
  status public.payment_status not null default 'pending',
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  check (period_end > period_start),
  check (
    status <> 'paid'
    or (period_start is not null and period_end is not null and paid_at is not null)
  )
);

create index subscriptions_tenant_id_idx on public.subscriptions (tenant_id);

alter table public.subscriptions enable row level security;

-- profiles --------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id),
  tenant_id uuid references public.tenants (id),
  role public.user_role not null,
  full_name text not null check (length(trim(full_name)) > 0),
  nis_nip text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  -- Super Admin tanpa tenant; peran lain wajib terikat satu tenant
  check ((role = 'super_admin') = (tenant_id is null)),
  -- murid login dengan NIS, jadi wajib ada
  check (role <> 'student' or nis_nip is not null),
  -- NIS/NIP unik per sekolah (NULL boleh berulang)
  unique (tenant_id, nis_nip)
);

-- unique (tenant_id, nis_nip) sudah menjadi index dengan tenant_id di depan,
-- cukup untuk filter RLS per tenant.

alter table public.profiles enable row level security;
