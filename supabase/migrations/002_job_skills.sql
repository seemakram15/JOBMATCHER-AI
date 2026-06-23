create table if not exists job_skills (
  id bigserial primary key,
  job_id uuid references jobs(id) on delete cascade,
  skill_name text not null,
  skill_canonical text,
  required boolean default true,
  weight numeric(4,2) default 1.0,
  created_at timestamptz default now(),
  unique (job_id, skill_canonical)
);

create index if not exists idx_job_skills_job on job_skills (job_id);
create index if not exists idx_job_skills_canonical on job_skills (skill_canonical);

alter table job_skills enable row level security;

create policy "public_read_job_skills" on job_skills for select using (true);
create policy "admin_write_job_skills" on job_skills for all using (auth.jwt() ->> 'role' = 'admin');
