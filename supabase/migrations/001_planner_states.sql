create table public.planner_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null,
  imported_legacy_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger planner_states_set_updated_at
before update on public.planner_states
for each row execute function public.set_updated_at();

alter table public.planner_states enable row level security;

grant select, insert, update, delete on public.planner_states to authenticated;

create policy "Users can read their own planner state"
on public.planner_states
for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own planner state"
on public.planner_states
for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own planner state"
on public.planner_states
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own planner state"
on public.planner_states
for delete to authenticated
using ((select auth.uid()) = user_id);
