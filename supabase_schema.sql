-- ====================================================================
--  Supabase SQL bootstrap – Phase 6 (schema + RLS + roles)
--  Save as: supabase/migrations/20250707T000001_create_forms.sql
-- ====================================================================

-- 1 ▸ schema
create table if not exists public.forms_intake (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamp with time zone default now(),
  payload      jsonb               not null, -- encrypted or plaintext
  encrypted    boolean             not null default false,
  ip_addr      inet,                         -- populated by edge fn
  recaptcha    text,                         -- token hash
  metadata     jsonb                          -- extra (UA, etc.)
);

-- 2 ▸ RLS (row‑level security)
alter table public.forms_intake enable row level security;

create policy "Forms: service role read / write" on public.forms_intake
  for all using ( auth.role() = 'service_role' );

create policy "Forms: anon insert" on public.forms_intake
  for insert with check ( true );

-- Prevent anon select / update / delete
create policy "Forms: anon no select" on public.forms_intake
  for select using ( false );
create policy "Forms: anon no update" on public.forms_intake
  for update using ( false );
create policy "Forms: anon no delete" on public.forms_intake
  for delete using ( false );

-- 3 ▸ Indexes
create index if not exists forms_intake_created_at_idx on public.forms_intake(created_at);

-- 4 ▸ minimal role hardening (assumes project defaults)
-- revoke default public privileges
revoke all on public.forms_intake from anon, authenticated;
-- grant insert only to anon (public website)
grant insert on public.forms_intake to anon;

-- 5 ▸ comment for docs
comment on table public.forms_intake is
  'Stores candidate and client contact submissions from the OPS landing page. Encrypted flag true = AES‑GCM ciphertext blob.';
-- ====================================================================
-- End of migration file
-- ====================================================================
