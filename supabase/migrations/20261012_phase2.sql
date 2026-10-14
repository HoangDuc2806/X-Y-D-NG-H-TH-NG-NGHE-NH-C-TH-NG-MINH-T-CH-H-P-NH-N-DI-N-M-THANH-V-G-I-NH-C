-- Music Discovery Vietnam - Phase 2. Chạy bằng SQL Editor HOẶC Alembic, KHÔNG cả hai.
-- Schema quản lý riêng tư: thông tin bài hát chỉ lưu provider/id, KHÔNG copy metadata Spotify.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name varchar(80) not null default 'Người dùng',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint profiles_display_name_not_blank check (length(trim(display_name)) >= 1)
);
create table if not exists public.playlists (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 name varchar(100) not null,
 description varchar(500) not null default '',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint playlists_name_not_blank check (length(trim(name)) >= 1),
 constraint playlists_id_user_id_key unique (id, user_id)
);
create index if not exists playlists_user_created_idx on public.playlists (user_id, created_at desc);

create table if not exists public.playlist_items (
 id uuid primary key default gen_random_uuid(),
 playlist_id uuid not null,
 user_id uuid not null,
 provider varchar(16) not null check (provider in ('spotify', 'licensed')),
 track_id varchar(200) not null check (length(trim(track_id)) >= 1),
 position integer not null default 0 check (position >= 0),
 added_at timestamptz not null default now(),
 constraint playlist_items_playlist_owner_fk foreign key (playlist_id,user_id)
    references public.playlists(id,user_id) on delete cascade,
 constraint playlist_items_unique_track unique (playlist_id,provider,track_id)
);
create index if not exists playlist_items_playlist_position_idx on public.playlist_items(playlist_id,position);
create index if not exists playlist_items_user_idx on public.playlist_items(user_id);

create table if not exists public.favorites (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 provider varchar(16) not null check (provider in ('spotify', 'licensed')),
 track_id varchar(200) not null check (length(trim(track_id)) >= 1),
 created_at timestamptz not null default now(),
 constraint favorites_unique_track unique (user_id,provider,track_id)
);
create index if not exists favorites_user_created_idx on public.favorites(user_id,created_at desc);

create table if not exists public.listening_history (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 provider varchar(16) not null check (provider in ('spotify', 'licensed')),
 track_id varchar(200) not null check (length(trim(track_id)) >= 1),
 listened_seconds integer not null default 0 check (listened_seconds >= 0),
 played_at timestamptz not null default now()
);
create index if not exists listening_history_user_played_idx on public.listening_history(user_id,played_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
drop trigger if exists playlists_updated_at on public.playlists;
create trigger playlists_updated_at before update on public.playlists
for each row execute function public.set_updated_at();

-- Tạo profile tự động ngay khi Auth tạo user. Không nhận user_id từ metadata.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.profiles (id, display_name)
 values (new.id, coalesce(nullif(left(trim(new.raw_user_meta_data->>'display_name'),80),''),'Người dùng'))
 on conflict (id) do nothing;
 return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();
-- Backfill những người dùng được tạo trước khi có trigger
insert into public.profiles (id,display_name)
select id,coalesce(nullif(left(trim(raw_user_meta_data->>'display_name'),80),''),'Người dùng')
from auth.users on conflict (id) do nothing;

-- RLS BẮT BUỘC trên mọi bảng public, không có quyền SELECT cho anon.
alter table public.profiles enable row level security;
alter table public.playlists enable row level security;
alter table public.playlist_items enable row level security;
alter table public.favorites enable row level security;
alter table public.listening_history enable row level security;

revoke all on public.profiles, public.playlists, public.playlist_items, public.favorites, public.listening_history from PUBLIC, anon;
grant select,insert,update,delete on public.profiles, public.playlists, public.playlist_items, public.favorites, public.listening_history to authenticated;
-- Không cấp quyền update cột user_id / id; RLS còn kiểm tra chủ sở hữu.
revoke update on public.profiles, public.playlists, public.playlist_items, public.favorites, public.listening_history from authenticated;
grant update (display_name) on public.profiles to authenticated;
grant update (name, description) on public.playlists to authenticated;
grant update (position) on public.playlist_items to authenticated;

create policy "profile_read_own" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "profile_insert_own" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy "profile_update_own" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "profile_delete_own" on public.profiles for delete to authenticated using ((select auth.uid()) = id);

create policy "playlist_read_own" on public.playlists for select to authenticated using ((select auth.uid()) = user_id);
create policy "playlist_insert_own" on public.playlists for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "playlist_update_own" on public.playlists for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "playlist_delete_own" on public.playlists for delete to authenticated using ((select auth.uid()) = user_id);

create policy "item_read_own" on public.playlist_items for select to authenticated using ((select auth.uid()) = user_id);
create policy "item_insert_own" on public.playlist_items for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "item_update_own" on public.playlist_items for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "item_delete_own" on public.playlist_items for delete to authenticated using ((select auth.uid()) = user_id);

create policy "favorite_read_own" on public.favorites for select to authenticated using ((select auth.uid()) = user_id);
create policy "favorite_insert_own" on public.favorites for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "favorite_delete_own" on public.favorites for delete to authenticated using ((select auth.uid()) = user_id);

create policy "history_read_own" on public.listening_history for select to authenticated using ((select auth.uid()) = user_id);
create policy "history_insert_own" on public.listening_history for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "history_delete_own" on public.listening_history for delete to authenticated using ((select auth.uid()) = user_id);

-- Bucket riêng tư (Giai đoạn 5 mới xây giao diện upload; KHÔNG upload tự động lúc nhận diện).
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('user-audio','user-audio',false,26214400,array['audio/mpeg','audio/wav','audio/x-wav','audio/ogg','audio/webm','audio/mp4'])
on conflict (id) do update
set public = false, file_size_limit = 26214400, allowed_mime_types = excluded.allowed_mime_types;
create policy "audio_owner_select" on storage.objects for select to authenticated
using (bucket_id = 'user-audio' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "audio_owner_insert" on storage.objects for insert to authenticated
with check (bucket_id = 'user-audio' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "audio_owner_delete" on storage.objects for delete to authenticated
using (bucket_id = 'user-audio' and (storage.foldername(name))[1] = (select auth.uid())::text);
