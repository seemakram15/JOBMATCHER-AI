alter table users
  add column if not exists target_roles text[] default array[]::text[],
  add column if not exists must_have_skills text[] default array[]::text[],
  add column if not exists avoid_keywords text[] default array[]::text[],
  add column if not exists preferred_countries text[] default array[]::text[],
  add column if not exists preferred_cities text[] default array[]::text[],
  add column if not exists remote_preference text default 'remote',
  add column if not exists minimum_salary numeric default 0,
  add column if not exists experience_years numeric default 0,
  add column if not exists good_job_examples text[] default array[]::text[],
  add column if not exists bad_job_examples text[] default array[]::text[],
  add column if not exists profile_completed_at timestamptz;

update users
set
  target_roles = case
    when cardinality(coalesce(target_roles, array[]::text[])) = 0 and coalesce(target_role, '') <> '' then array[target_role]
    else coalesce(target_roles, array[]::text[])
  end,
  preferred_countries = case
    when cardinality(coalesce(preferred_countries, array[]::text[])) = 0 and coalesce(location, '') = 'Remote' then array['Remote']
    when cardinality(coalesce(preferred_countries, array[]::text[])) = 0 and coalesce(location, '') <> '' then array[location]
    else coalesce(preferred_countries, array[]::text[])
  end,
  preferred_cities = case
    when cardinality(coalesce(preferred_cities, array[]::text[])) = 0 and coalesce(location, '') = 'Remote' then array['Remote']
    when cardinality(coalesce(preferred_cities, array[]::text[])) = 0 and coalesce(location, '') <> '' then array[location]
    else coalesce(preferred_cities, array[]::text[])
  end,
  remote_preference = case
    when remote_preference in ('remote', 'hybrid', 'onsite', 'any') then remote_preference
    when preferred_remote then 'remote'
    else 'onsite'
  end,
  minimum_salary = coalesce(minimum_salary, salary_min, 0),
  experience_years = coalesce(experience_years, 0),
  good_job_examples = coalesce(good_job_examples, array[]::text[]),
  bad_job_examples = coalesce(bad_job_examples, array[]::text[]),
  must_have_skills = coalesce(must_have_skills, array[]::text[]),
  avoid_keywords = coalesce(avoid_keywords, array[]::text[]);

alter table users drop constraint if exists users_profile_preferences_bounds;
alter table users add constraint users_profile_preferences_bounds check (
  remote_preference in ('remote', 'hybrid', 'onsite', 'any')
  and cardinality(coalesce(target_roles, array[]::text[])) <= 10
  and cardinality(coalesce(must_have_skills, array[]::text[])) <= 30
  and cardinality(coalesce(avoid_keywords, array[]::text[])) <= 30
  and cardinality(coalesce(preferred_countries, array[]::text[])) <= 8
  and cardinality(coalesce(preferred_cities, array[]::text[])) <= 12
  and cardinality(coalesce(good_job_examples, array[]::text[])) <= 12
  and cardinality(coalesce(bad_job_examples, array[]::text[])) <= 12
  and coalesce(minimum_salary, 0) between 0 and 1000000
  and coalesce(experience_years, 0) between 0 and 60
);

drop policy if exists "authenticated_insert_live_jobs" on jobs;
create policy "authenticated_insert_live_jobs" on jobs
  for insert to authenticated with check (
    source_platform in ('Remotive', 'RemoteOK', 'Google Jobs', 'Adzuna', 'Jooble', 'JSearch', 'OpenWeb Ninja')
      or source_platform like 'Google Jobs (%)'
  );
