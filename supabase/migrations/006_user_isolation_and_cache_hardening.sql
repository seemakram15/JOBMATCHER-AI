-- 006_user_isolation_and_cache_hardening.sql
-- Locks user-owned records to their owner, removes browser-client writes to
-- shared job cache tables, and prevents profile self-escalation.

alter table public.users enable row level security;
alter table public.cvs enable row level security;
alter table public.cv_skills enable row level security;
alter table public.cv_experience enable row level security;
alter table public.jobs enable row level security;
alter table public.job_skills enable row level security;
alter table public.user_job_scores enable row level security;
alter table public.applications enable row level security;
alter table public.application_history enable row level security;
alter table public.saved_jobs enable row level security;
alter table public.notifications enable row level security;
alter table public.search_events enable row level security;

alter table public.cv_skills
  add column if not exists skill_rank integer default 70;

alter table public.cv_skills drop constraint if exists cv_skills_rank_bounds;
alter table public.cv_skills
  add constraint cv_skills_rank_bounds check (coalesce(skill_rank, 70) between 0 and 100);

alter table public.search_events drop constraint if exists search_events_security_bounds;
alter table public.search_events
  add constraint search_events_security_bounds check (
    char_length(coalesce(query, '')) <= 200
    and coalesce(result_count, 0) between 0 and 500
  );

create or replace function public.is_service_role()
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role';
$$;

revoke all on function public.is_service_role() from public;
grant execute on function public.is_service_role() to authenticated;

create or replace function public.prevent_unsafe_user_profile_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.id is distinct from old.id then
    raise exception 'user id cannot be changed';
  end if;

  if (
    new.email is distinct from old.email
    or new.role is distinct from old.role
    or new.is_active is distinct from old.is_active
  ) and not (public.is_service_role() or public.is_superadmin()) then
    raise exception 'protected account fields require elevated privileges';
  end if;

  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists prevent_unsafe_user_profile_update on public.users;
create trigger prevent_unsafe_user_profile_update
  before update on public.users
  for each row execute function public.prevent_unsafe_user_profile_update();

drop policy if exists "authenticated_insert_jobs" on public.jobs;
drop policy if exists "authenticated_update_jobs" on public.jobs;
drop policy if exists "authenticated_insert_live_jobs" on public.jobs;
drop policy if exists "admin_write_jobs" on public.jobs;
drop policy if exists "admin_insert_jobs" on public.jobs;
drop policy if exists "admin_update_jobs" on public.jobs;
drop policy if exists "admin_delete_jobs" on public.jobs;
drop policy if exists "public_read_jobs" on public.jobs;

create policy "public_read_jobs" on public.jobs
  for select using (is_active = true and is_expired = false);
create policy "admin_insert_jobs" on public.jobs
  for insert to authenticated with check (public.is_admin());
create policy "admin_update_jobs" on public.jobs
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin_delete_jobs" on public.jobs
  for delete to authenticated using (public.is_admin());

drop policy if exists "public_read_job_skills" on public.job_skills;
drop policy if exists "admin_write_job_skills" on public.job_skills;
drop policy if exists "admin_insert_job_skills" on public.job_skills;
drop policy if exists "admin_update_job_skills" on public.job_skills;
drop policy if exists "admin_delete_job_skills" on public.job_skills;

create policy "public_read_job_skills" on public.job_skills
  for select using (
    exists (
      select 1
      from public.jobs
      where jobs.id = job_skills.job_id
        and jobs.is_active = true
        and jobs.is_expired = false
    )
  );
create policy "admin_insert_job_skills" on public.job_skills
  for insert to authenticated with check (public.is_admin());
create policy "admin_update_job_skills" on public.job_skills
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin_delete_job_skills" on public.job_skills
  for delete to authenticated using (public.is_admin());

drop policy if exists "own_application_history_insert" on public.application_history;
create policy "own_application_history_insert" on public.application_history
  for insert with check (
    changed_by = auth.uid()
    and application_id in (select id from public.applications where user_id = auth.uid())
  );

drop policy if exists "own_cv_files_read" on storage.objects;
drop policy if exists "own_cv_files_insert" on storage.objects;
drop policy if exists "own_cv_files_update" on storage.objects;
drop policy if exists "own_cv_files_delete" on storage.objects;
drop policy if exists "own_cv_storage_select" on storage.objects;
drop policy if exists "own_cv_storage_insert" on storage.objects;
drop policy if exists "own_cv_storage_update" on storage.objects;
drop policy if exists "own_cv_storage_delete" on storage.objects;

create policy "own_cv_storage_select" on storage.objects
  for select to authenticated using (
    bucket_id = 'cvs'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "own_cv_storage_insert" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'cvs'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "own_cv_storage_update" on storage.objects
  for update to authenticated using (
    bucket_id = 'cvs'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  ) with check (
    bucket_id = 'cvs'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "own_cv_storage_delete" on storage.objects
  for delete to authenticated using (
    bucket_id = 'cvs'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );
