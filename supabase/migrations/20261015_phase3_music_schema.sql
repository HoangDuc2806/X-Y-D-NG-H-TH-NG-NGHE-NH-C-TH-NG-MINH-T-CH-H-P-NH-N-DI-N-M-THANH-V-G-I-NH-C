-- =====================================
-- PHASE 3 MUSIC DISCOVERY DATABASE
-- =====================================


-- 1. USER PROFILE
create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,

    display_name text,
    avatar_url text,

    created_at timestamp with time zone
        default now(),

    updated_at timestamp with time zone
        default now()
);



-- 2. FAVORITE SONGS

create table if not exists public.favorites (

    id uuid primary key default gen_random_uuid(),

    user_id uuid not null
        references auth.users(id)
        on delete cascade,

    track_id text not null,
    track_name text,
    artist_name text,
    album_name text,
    cover_url text,
    spotify_url text,

    created_at timestamp with time zone
        default now(),

    unique(user_id, track_id)
);



-- 3. PLAYLIST

create table if not exists public.playlists (

    id uuid primary key default gen_random_uuid(),

    user_id uuid not null
        references auth.users(id)
        on delete cascade,

    name text not null,

    description text,

    created_at timestamp with time zone
        default now()
);



-- 4. SONGS IN PLAYLIST

create table if not exists public.playlist_tracks (

    id uuid primary key default gen_random_uuid(),

    playlist_id uuid not null
        references public.playlists(id)
        on delete cascade,

    track_id text not null,

    track_name text,
    artist_name text,
    album_name text,
    cover_url text,
    spotify_url text,

    position integer default 0,

    created_at timestamp with time zone
        default now()
);



-- 5. LISTENING HISTORY

create table if not exists public.listening_history (

    id uuid primary key default gen_random_uuid(),

    user_id uuid not null
        references auth.users(id)
        on delete cascade,


    track_id text not null,

    track_name text,
    artist_name text,
    album_name text,
    cover_url text,


    listened_at timestamp with time zone
        default now()

);

-- ENABLE RLS

alter table public.profiles enable row level security;

alter table public.favorites enable row level security;

alter table public.playlists enable row level security;

alter table public.playlist_tracks enable row level security;

alter table public.listening_history enable row level security;

create policy "Users can view own profile"
on public.profiles
for select
using (
auth.uid() = id
);


create policy "Users can update own profile"
on public.profiles
for update
using (
auth.uid() = id
);

create policy "Users manage own favorites"
on public.favorites
for all
using (
auth.uid() = user_id
);

create policy "Users manage own playlists"
on public.playlists
for all
using (
auth.uid() = user_id
);

create policy "Users manage playlist tracks"
on public.playlist_tracks
for all
using (
exists(
select 1
from public.playlists
where playlists.id = playlist_tracks.playlist_id
and playlists.user_id = auth.uid()
)
);

create policy "Users manage own history"
on public.listening_history
for all
using (
auth.uid() = user_id
);