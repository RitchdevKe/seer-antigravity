-- PHA Cache for Incremental updates
-- Purpose: Stop recalculating all historical matches in memory for every save.
-- Run this once in the Supabase SQL editor.

create table if not exists public.pha_cache (
    id text primary key,
    stats_data jsonb not null default '{}'::jsonb,
    last_full_recalc timestamp with time zone,
    updated_at timestamp with time zone default now()
);

-- Initialize the singleton row
insert into public.pha_cache (id, stats_data)
values ('singleton', '{}'::jsonb)
on conflict (id) do nothing;

-- Set up Row Level Security
alter table public.pha_cache enable row level security;

create policy "Allow public select on pha_cache" 
on public.pha_cache for select 
using (true);

create policy "Allow public insert on pha_cache" 
on public.pha_cache for insert 
with check (true);

create policy "Allow public update on pha_cache" 
on public.pha_cache for update 
using (true);
