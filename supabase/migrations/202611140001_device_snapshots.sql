-- NOVA device-level cloud sync.
-- Each app installation receives a Supabase anonymous Auth identity.
-- No email, password, or profile details are collected by this schema.

create table if not exists public.device_snapshots (
  device_id uuid primary key references auth.users (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.device_snapshots enable row level security;

revoke all on table public.device_snapshots from anon;
grant select, insert, update, delete on table public.device_snapshots to authenticated;

drop policy if exists "A device can read its own snapshot" on public.device_snapshots;
create policy "A device can read its own snapshot"
on public.device_snapshots
for select
to authenticated
using (
  (select auth.uid()) = device_id
  and (select auth.jwt() ->> 'is_anonymous') = 'true'
);

drop policy if exists "A device can create its own snapshot" on public.device_snapshots;
create policy "A device can create its own snapshot"
on public.device_snapshots
for insert
to authenticated
with check (
  (select auth.uid()) = device_id
  and (select auth.jwt() ->> 'is_anonymous') = 'true'
);

drop policy if exists "A device can update its own snapshot" on public.device_snapshots;
create policy "A device can update its own snapshot"
on public.device_snapshots
for update
to authenticated
using (
  (select auth.uid()) = device_id
  and (select auth.jwt() ->> 'is_anonymous') = 'true'
)
with check (
  (select auth.uid()) = device_id
  and (select auth.jwt() ->> 'is_anonymous') = 'true'
);

drop policy if exists "A device can delete its own snapshot" on public.device_snapshots;
create policy "A device can delete its own snapshot"
on public.device_snapshots
for delete
to authenticated
using (
  (select auth.uid()) = device_id
  and (select auth.jwt() ->> 'is_anonymous') = 'true'
);
