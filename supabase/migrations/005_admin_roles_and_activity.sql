-- 005_admin_roles_and_activity.sql
-- Adds a 'superadmin' role, a search-activity table, and admin/superadmin helpers.
-- Cross-user reads for the admin console happen through a verified service-role
-- API endpoint (api/admin.ts), so per-user RLS below stays owner-only.

-- 1. Allow the 'superadmin' role on the users profile table.
alter table public.users drop constraint if exists users_role_check;
alter table public.users
  add constraint users_role_check check (role in ('job_seeker', 'admin', 'superadmin'));

-- 2. Admin / superadmin predicates (security definer so they can read users.role).
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users
    where id = auth.uid()
      and role in ('admin', 'superadmin')
      and is_active = true
  );
$$;

create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users
    where id = auth.uid()
      and role = 'superadmin'
      and is_active = true
  );
$$;

revoke all on function public.is_admin() from public;
revoke all on function public.is_superadmin() from public;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_superadmin() to authenticated;

-- 3. Track live searches per user (powers the admin "searches" stat).
create table if not exists public.search_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  query text,
  result_count integer default 0,
  created_at timestamptz default now()
);

create index if not exists search_events_user_idx on public.search_events (user_id);
create index if not exists search_events_created_idx on public.search_events (created_at desc);

alter table public.search_events enable row level security;

drop policy if exists "own_search_events_insert" on public.search_events;
drop policy if exists "own_search_events_select" on public.search_events;
drop policy if exists "admin_search_events_select" on public.search_events;

create policy "own_search_events_insert" on public.search_events
  for insert with check (user_id = auth.uid());
create policy "own_search_events_select" on public.search_events
  for select using (user_id = auth.uid());
create policy "admin_search_events_select" on public.search_events
  for select using (public.is_admin());
