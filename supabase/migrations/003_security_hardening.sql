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
      and role = 'admin'
      and is_active = true
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

alter table users enable row level security;
alter table cvs enable row level security;
alter table cv_skills enable row level security;
alter table cv_experience enable row level security;
alter table jobs enable row level security;
alter table user_job_scores enable row level security;
alter table applications enable row level security;
alter table application_history enable row level security;
alter table saved_jobs enable row level security;
alter table notifications enable row level security;
alter table job_sources enable row level security;
alter table scraper_logs enable row level security;

drop policy if exists "own_cv_storage_select" on storage.objects;
drop policy if exists "own_cv_storage_insert" on storage.objects;
drop policy if exists "own_cv_storage_update" on storage.objects;
drop policy if exists "own_cv_storage_delete" on storage.objects;
create policy "own_cv_storage_select" on storage.objects
  for select using (
    bucket_id = 'cvs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "own_cv_storage_insert" on storage.objects
  for insert with check (
    bucket_id = 'cvs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "own_cv_storage_update" on storage.objects
  for update using (
    bucket_id = 'cvs'
    and (storage.foldername(name))[1] = auth.uid()::text
  ) with check (
    bucket_id = 'cvs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "own_cv_storage_delete" on storage.objects
  for delete using (
    bucket_id = 'cvs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "own_user_select" on users;
drop policy if exists "own_user_insert" on users;
drop policy if exists "own_user_update" on users;
create policy "own_user_select" on users for select using (id = auth.uid());
create policy "own_user_insert" on users for insert with check (id = auth.uid());
create policy "own_user_update" on users for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "own_cvs" on cvs;
drop policy if exists "own_cvs_select" on cvs;
drop policy if exists "own_cvs_insert" on cvs;
drop policy if exists "own_cvs_update" on cvs;
drop policy if exists "own_cvs_delete" on cvs;
create policy "own_cvs_select" on cvs for select using (user_id = auth.uid());
create policy "own_cvs_insert" on cvs for insert with check (user_id = auth.uid());
create policy "own_cvs_update" on cvs for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own_cvs_delete" on cvs for delete using (user_id = auth.uid());

drop policy if exists "own_cv_skills_select" on cv_skills;
drop policy if exists "own_cv_skills_insert" on cv_skills;
drop policy if exists "own_cv_skills_update" on cv_skills;
drop policy if exists "own_cv_skills_delete" on cv_skills;
create policy "own_cv_skills_select" on cv_skills
  for select using (cv_id in (select id from cvs where user_id = auth.uid()));
create policy "own_cv_skills_insert" on cv_skills
  for insert with check (cv_id in (select id from cvs where user_id = auth.uid()));
create policy "own_cv_skills_update" on cv_skills
  for update using (cv_id in (select id from cvs where user_id = auth.uid()))
  with check (cv_id in (select id from cvs where user_id = auth.uid()));
create policy "own_cv_skills_delete" on cv_skills
  for delete using (cv_id in (select id from cvs where user_id = auth.uid()));

drop policy if exists "own_cv_experience_select" on cv_experience;
drop policy if exists "own_cv_experience_insert" on cv_experience;
drop policy if exists "own_cv_experience_update" on cv_experience;
drop policy if exists "own_cv_experience_delete" on cv_experience;
create policy "own_cv_experience_select" on cv_experience
  for select using (cv_id in (select id from cvs where user_id = auth.uid()));
create policy "own_cv_experience_insert" on cv_experience
  for insert with check (cv_id in (select id from cvs where user_id = auth.uid()));
create policy "own_cv_experience_update" on cv_experience
  for update using (cv_id in (select id from cvs where user_id = auth.uid()))
  with check (cv_id in (select id from cvs where user_id = auth.uid()));
create policy "own_cv_experience_delete" on cv_experience
  for delete using (cv_id in (select id from cvs where user_id = auth.uid()));

drop policy if exists "public_read_jobs" on jobs;
drop policy if exists "admin_write_jobs" on jobs;
drop policy if exists "authenticated_insert_jobs" on jobs;
drop policy if exists "authenticated_update_jobs" on jobs;
drop policy if exists "authenticated_insert_live_jobs" on jobs;
drop policy if exists "admin_update_jobs" on jobs;
drop policy if exists "admin_delete_jobs" on jobs;
create policy "public_read_jobs" on jobs
  for select using (is_active = true and is_expired = false);
create policy "authenticated_insert_live_jobs" on jobs
  for insert to authenticated with check (
    source_platform in ('Remotive', 'RemoteOK', 'Google Jobs')
      or source_platform like 'Google Jobs (%)'
  );
create policy "admin_update_jobs" on jobs for update using (public.is_admin()) with check (public.is_admin());
create policy "admin_delete_jobs" on jobs for delete using (public.is_admin());

drop policy if exists "own_scores" on user_job_scores;
drop policy if exists "own_scores_select" on user_job_scores;
drop policy if exists "own_scores_insert" on user_job_scores;
drop policy if exists "own_scores_update" on user_job_scores;
drop policy if exists "own_scores_delete" on user_job_scores;
create policy "own_scores_select" on user_job_scores for select using (user_id = auth.uid());
create policy "own_scores_insert" on user_job_scores
  for insert with check (
    user_id = auth.uid()
      and (cv_id is null or cv_id in (select id from cvs where user_id = auth.uid()))
  );
create policy "own_scores_update" on user_job_scores
  for update using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
      and (cv_id is null or cv_id in (select id from cvs where user_id = auth.uid()))
  );
create policy "own_scores_delete" on user_job_scores for delete using (user_id = auth.uid());

drop policy if exists "own_applications" on applications;
drop policy if exists "own_applications_select" on applications;
drop policy if exists "own_applications_insert" on applications;
drop policy if exists "own_applications_update" on applications;
drop policy if exists "own_applications_delete" on applications;
create policy "own_applications_select" on applications for select using (user_id = auth.uid());
create policy "own_applications_insert" on applications
  for insert with check (
    user_id = auth.uid()
      and (cv_id is null or cv_id in (select id from cvs where user_id = auth.uid()))
  );
create policy "own_applications_update" on applications
  for update using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
      and (cv_id is null or cv_id in (select id from cvs where user_id = auth.uid()))
  );
create policy "own_applications_delete" on applications for delete using (user_id = auth.uid());

drop policy if exists "own_application_history_select" on application_history;
drop policy if exists "own_application_history_insert" on application_history;
create policy "own_application_history_select" on application_history
  for select using (application_id in (select id from applications where user_id = auth.uid()));
create policy "own_application_history_insert" on application_history
  for insert with check (application_id in (select id from applications where user_id = auth.uid()));

drop policy if exists "own_saved_jobs" on saved_jobs;
drop policy if exists "own_saved_jobs_select" on saved_jobs;
drop policy if exists "own_saved_jobs_insert" on saved_jobs;
drop policy if exists "own_saved_jobs_delete" on saved_jobs;
create policy "own_saved_jobs_select" on saved_jobs for select using (user_id = auth.uid());
create policy "own_saved_jobs_insert" on saved_jobs for insert with check (user_id = auth.uid());
create policy "own_saved_jobs_delete" on saved_jobs for delete using (user_id = auth.uid());

drop policy if exists "own_notifications" on notifications;
drop policy if exists "own_notifications_select" on notifications;
drop policy if exists "own_notifications_update" on notifications;
drop policy if exists "own_notifications_delete" on notifications;
create policy "own_notifications_select" on notifications for select using (user_id = auth.uid());
create policy "own_notifications_update" on notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own_notifications_delete" on notifications for delete using (user_id = auth.uid());

drop policy if exists "admin_job_sources_all" on job_sources;
create policy "admin_job_sources_all" on job_sources for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin_scraper_logs_all" on scraper_logs;
create policy "admin_scraper_logs_all" on scraper_logs for all using (public.is_admin()) with check (public.is_admin());

alter table users drop constraint if exists users_security_bounds;
alter table users add constraint users_security_bounds check (
  char_length(email) <= 254
  and char_length(coalesce(name, '')) <= 160
  and char_length(coalesce(headline, '')) <= 240
  and char_length(coalesce(location, '')) <= 120
  and char_length(coalesce(target_role, '')) <= 160
  and coalesce(salary_min, 0) >= 0
  and coalesce(salary_max, 0) >= 0
  and char_length(coalesce(currency, 'USD')) = 3
);

alter table cvs drop constraint if exists cvs_security_bounds;
alter table cvs add constraint cvs_security_bounds check (
  char_length(coalesce(label, '')) <= 160
  and char_length(filename) <= 160
  and char_length(storage_path) <= 500
  and coalesce(file_size, 0) >= 0
  and coalesce(total_years_experience, 0) between 0 and 60
);

alter table cv_skills drop constraint if exists cv_skills_security_bounds;
alter table cv_skills add constraint cv_skills_security_bounds check (
  char_length(skill_name) <= 80
  and char_length(coalesce(skill_canonical, '')) <= 80
  and coalesce(years_used, 0) between 0 and 60
);

alter table cv_experience drop constraint if exists cv_experience_security_bounds;
alter table cv_experience add constraint cv_experience_security_bounds check (
  char_length(coalesce(title, '')) <= 160
  and char_length(coalesce(company, '')) <= 160
  and coalesce(total_months, 0) between 0 and 720
);

alter table jobs drop constraint if exists jobs_security_bounds;
update jobs
set
  experience_min = least(greatest(coalesce(experience_min, 0), 0), 60),
  experience_max = least(greatest(coalesce(experience_max, 0), 0), 60)
where coalesce(experience_min, 0) not between 0 and 60
   or coalesce(experience_max, 0) not between 0 and 60;
alter table jobs add constraint jobs_security_bounds check (
  char_length(title) <= 240
  and char_length(coalesce(company, '')) <= 180
  and char_length(coalesce(location, '')) <= 180
  and char_length(coalesce(source_platform, '')) <= 120
  and char_length(coalesce(description, '')) <= 50000
  and apply_url ~* '^https?://'
  and (source_url is null or source_url ~* '^https?://')
  and coalesce(salary_min, 0) >= 0
  and coalesce(salary_max, 0) >= 0
  and coalesce(experience_min, 0) between 0 and 60
  and coalesce(experience_max, 0) between 0 and 60
);

alter table applications drop constraint if exists applications_security_bounds;
alter table applications add constraint applications_security_bounds check (
  char_length(coalesce(notes, '')) <= 1000
);

alter table notifications drop constraint if exists notifications_security_bounds;
alter table notifications add constraint notifications_security_bounds check (
  char_length(title) <= 160
  and char_length(coalesce(message, '')) <= 500
  and (action_url is null or action_url ~* '^/')
);
