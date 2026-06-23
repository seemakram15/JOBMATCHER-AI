alter table users enable row level security;

drop policy if exists "own_user_select" on users;
create policy "own_user_select" on users
  for select using (id = auth.uid());

drop policy if exists "own_user_insert" on users;
create policy "own_user_insert" on users
  for insert with check (id = auth.uid());

drop policy if exists "own_user_update" on users;
create policy "own_user_update" on users
  for update using (id = auth.uid()) with check (id = auth.uid());

alter table cvs
  add column if not exists total_years_experience numeric(4,1) default 0;

alter table cv_experience enable row level security;
alter table application_history enable row level security;

drop policy if exists "own_cv_skills_select" on cv_skills;
create policy "own_cv_skills_select" on cv_skills
  for select using (cv_id in (select id from cvs where user_id = auth.uid()));

drop policy if exists "own_cv_skills_insert" on cv_skills;
create policy "own_cv_skills_insert" on cv_skills
  for insert with check (cv_id in (select id from cvs where user_id = auth.uid()));

drop policy if exists "own_cv_skills_update" on cv_skills;
create policy "own_cv_skills_update" on cv_skills
  for update using (cv_id in (select id from cvs where user_id = auth.uid()))
  with check (cv_id in (select id from cvs where user_id = auth.uid()));

drop policy if exists "own_cv_skills_delete" on cv_skills;
create policy "own_cv_skills_delete" on cv_skills
  for delete using (cv_id in (select id from cvs where user_id = auth.uid()));

drop policy if exists "own_cv_experience_select" on cv_experience;
create policy "own_cv_experience_select" on cv_experience
  for select using (cv_id in (select id from cvs where user_id = auth.uid()));

drop policy if exists "own_cv_experience_insert" on cv_experience;
create policy "own_cv_experience_insert" on cv_experience
  for insert with check (cv_id in (select id from cvs where user_id = auth.uid()));

drop policy if exists "own_cv_experience_update" on cv_experience;
create policy "own_cv_experience_update" on cv_experience
  for update using (cv_id in (select id from cvs where user_id = auth.uid()))
  with check (cv_id in (select id from cvs where user_id = auth.uid()));

drop policy if exists "own_cv_experience_delete" on cv_experience;
create policy "own_cv_experience_delete" on cv_experience
  for delete using (cv_id in (select id from cvs where user_id = auth.uid()));

drop policy if exists "authenticated_insert_jobs" on jobs;
create policy "authenticated_insert_jobs" on jobs
  for insert to authenticated with check (true);

drop policy if exists "authenticated_update_jobs" on jobs;
create policy "authenticated_update_jobs" on jobs
  for update to authenticated using (true) with check (true);

drop policy if exists "own_application_history_select" on application_history;
create policy "own_application_history_select" on application_history
  for select using (
    application_id in (select id from applications where user_id = auth.uid())
  );

drop policy if exists "own_application_history_insert" on application_history;
create policy "own_application_history_insert" on application_history
  for insert with check (
    application_id in (select id from applications where user_id = auth.uid())
  );

do $$
begin
  if exists (
    select 1
    from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'applications'
      and constraint_name = 'applications_status_check'
  ) then
    alter table applications drop constraint applications_status_check;
  end if;
end $$;

alter table applications
  add constraint applications_status_check check (status in (
    'saved','applied','interviewing','offer','rejected','withdrawn','archived'
  ));
