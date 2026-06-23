create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text,
  avatar_url text,
  headline text,
  location text,
  target_role text,
  salary_min integer,
  salary_max integer,
  currency text default 'USD',
  preferred_remote boolean default false,
  role text default 'job_seeker' check (role in ('job_seeker', 'admin')),
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists cvs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  label text default 'My CV',
  filename text not null,
  storage_path text not null,
  file_size integer,
  mime_type text,
  version integer default 1,
  is_active boolean default false,
  parsed_at timestamptz,
  parse_status text default 'pending' check (parse_status in ('pending','processing','done','failed')),
  created_at timestamptz default now()
);

create table if not exists cv_skills (
  id bigserial primary key,
  cv_id uuid references cvs(id) on delete cascade,
  skill_name text not null,
  skill_canonical text,
  skill_type text check (skill_type in ('technical','soft','language','tool','framework','certification')),
  years_used numeric(4,1),
  confidence text default 'high' check (confidence in ('high','medium','low')),
  is_manual boolean default false,
  created_at timestamptz default now()
);

create table if not exists cv_experience (
  id bigserial primary key,
  cv_id uuid references cvs(id) on delete cascade,
  title text,
  company text,
  start_date date,
  end_date date,
  is_current boolean default false,
  total_months integer,
  description text,
  created_at timestamptz default now()
);

create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  company text,
  company_logo text,
  location text,
  country text,
  city text,
  is_remote boolean default false,
  work_mode text check (work_mode in ('remote','hybrid','onsite')),
  description text,
  description_html text,
  salary_min integer,
  salary_max integer,
  salary_currency text default 'USD',
  job_type text check (job_type in ('full_time','part_time','contract','freelance','internship')),
  experience_min numeric(3,1),
  experience_max numeric(3,1),
  level text check (level in ('entry','mid','senior','lead','executive')),
  skills_required jsonb default '[]',
  apply_url text not null,
  source_url text,
  source_platform text not null,
  external_id text,
  dedup_hash text unique,
  is_active boolean default true,
  is_expired boolean default false,
  posted_at timestamptz,
  expires_at timestamptz,
  fetched_at timestamptz default now(),
  last_seen_at timestamptz default now()
);

create table if not exists user_job_scores (
  id bigserial primary key,
  user_id uuid references users(id) on delete cascade,
  job_id uuid references jobs(id) on delete cascade,
  cv_id uuid references cvs(id) on delete set null,
  total_score smallint not null check (total_score between 0 and 100),
  skill_score smallint,
  experience_score smallint,
  title_score smallint,
  location_score smallint,
  recency_bonus smallint,
  matched_skills jsonb default '[]',
  missing_skills jsonb default '[]',
  match_summary text,
  computed_at timestamptz default now(),
  unique (user_id, job_id, cv_id)
);

create table if not exists applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  job_id uuid references jobs(id) on delete set null,
  cv_id uuid references cvs(id) on delete set null,
  status text default 'saved' check (status in (
    'saved','applied','phone_screen','interviewing','offer','rejected','withdrawn','archived'
  )),
  notes text,
  reminder_date date,
  applied_at timestamptz,
  last_updated timestamptz default now(),
  created_at timestamptz default now()
);

create table if not exists application_history (
  id bigserial primary key,
  application_id uuid references applications(id) on delete cascade,
  old_status text,
  new_status text not null,
  note text,
  changed_at timestamptz default now(),
  changed_by uuid references users(id)
);

create table if not exists saved_jobs (
  id bigserial primary key,
  user_id uuid references users(id) on delete cascade,
  job_id uuid references jobs(id) on delete cascade,
  saved_at timestamptz default now(),
  unique (user_id, job_id)
);

create table if not exists notifications (
  id bigserial primary key,
  user_id uuid references users(id) on delete cascade,
  type text check (type in ('new_match','job_expiry','follow_up_reminder','system','new_source')),
  title text not null,
  message text,
  action_url text,
  is_read boolean default false,
  created_at timestamptz default now()
);

create table if not exists job_sources (
  id bigserial primary key,
  name text unique not null,
  url text not null,
  method text check (method in ('api','rss','apify','serpapi')),
  apify_actor_id text,
  api_endpoint text,
  rss_url text,
  cron_expression text default '*/30 * * * *',
  is_active boolean default true,
  priority smallint default 5,
  last_run_at timestamptz,
  last_run_status text check (last_run_status in ('success','failed','running')),
  consecutive_failures smallint default 0,
  created_at timestamptz default now()
);

create table if not exists scraper_logs (
  id bigserial primary key,
  source_id bigint references job_sources(id),
  run_at timestamptz default now(),
  duration_ms integer,
  status text check (status in ('success','partial','failed')),
  jobs_fetched integer default 0,
  jobs_new integer default 0,
  jobs_updated integer default 0,
  jobs_duplicate integer default 0,
  error_message text,
  apify_run_id text
);

create index if not exists idx_jobs_posted_at on jobs (posted_at desc);
create index if not exists idx_jobs_source on jobs (source_platform);
create index if not exists idx_jobs_remote on jobs (is_remote) where is_remote = true;
create index if not exists idx_jobs_active on jobs (is_active, is_expired);
create index if not exists idx_scores_user_score on user_job_scores (user_id, total_score desc);
create index if not exists idx_apps_user_status on applications (user_id, status);
create index if not exists idx_notifs_user_unread on notifications (user_id, is_read) where is_read = false;
create index if not exists idx_jobs_fts on jobs using gin (
  to_tsvector('english', coalesce(title,'') || ' ' || coalesce(company,'') || ' ' || coalesce(description,''))
);

alter table cvs enable row level security;
alter table cv_skills enable row level security;
alter table applications enable row level security;
alter table saved_jobs enable row level security;
alter table notifications enable row level security;
alter table user_job_scores enable row level security;
alter table jobs enable row level security;

create policy "own_cvs" on cvs using (user_id = auth.uid());
create policy "own_applications" on applications using (user_id = auth.uid());
create policy "own_saved_jobs" on saved_jobs using (user_id = auth.uid());
create policy "own_notifications" on notifications using (user_id = auth.uid());
create policy "own_scores" on user_job_scores using (user_id = auth.uid());
create policy "public_read_jobs" on jobs for select using (true);
create policy "admin_write_jobs" on jobs for all using (auth.jwt() ->> 'role' = 'admin');
