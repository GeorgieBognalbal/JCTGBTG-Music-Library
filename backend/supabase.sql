create table public.songs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  artist text not null default 'Unknown artist',
  lyrics text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index songs_title_idx on public.songs (lower(title));

