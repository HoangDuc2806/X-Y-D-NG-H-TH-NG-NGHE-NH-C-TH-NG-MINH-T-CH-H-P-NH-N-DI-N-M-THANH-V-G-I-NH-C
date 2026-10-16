-- =============================================================
-- Thư viện: lưu metadata hiển thị (tên, nghệ sĩ, ảnh bìa, link Spotify)
-- cho favorites và listening_history.
--
-- AN TOÀN: chỉ THÊM cột/chỉ mục, không xóa hay sửa dữ liệu hiện có.
-- Có thể chạy lại nhiều lần (idempotent).
-- Chỉ lưu metadata văn bản/URL. KHÔNG lưu âm thanh Spotify.
--
-- TRƯỚC KHI CHẠY, kiểm tra schema thật đang dùng (dán vào Supabase SQL Editor):
--   select table_name, column_name, data_type
--   from information_schema.columns
--   where table_schema = 'public'
--     and table_name in ('favorites','listening_history','playlists','playlist_tracks')
--   order by table_name, ordinal_position;
-- Backend yêu cầu: favorites(provider, track_id), listening_history(provider, track_id,
-- listened_seconds, played_at), playlists(updated_at), playlist_tracks(track_name, ...).
-- Nếu thiếu `provider` ở favorites/listening_history, bạn đang ở schema Phase 3 cũ;
-- hãy dừng lại và báo để xử lý riêng, đừng chạy tiếp.
-- =============================================================

alter table public.favorites
  add column if not exists track_name  text,
  add column if not exists artist_name text,
  add column if not exists album_name  text,
  add column if not exists cover_url   text,
  add column if not exists spotify_url text;

alter table public.listening_history
  add column if not exists track_name  text,
  add column if not exists artist_name text,
  add column if not exists album_name  text,
  add column if not exists cover_url   text,
  add column if not exists spotify_url text;

-- Phục vụ truy vấn chống trùng lượt nghe (user + provider + track, mới nhất trước).
create index if not exists listening_history_user_track_played_idx
  on public.listening_history (user_id, provider, track_id, played_at desc);

-- Chặn thêm cùng một bài hai lần vào một playlist.
-- Chỉ tạo khi dữ liệu hiện có chưa bị trùng, tránh làm hỏng migration.
do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'playlist_tracks') then
    if exists (select 1 from public.playlist_tracks
               group by playlist_id, track_id having count(*) > 1) then
      raise notice 'playlist_tracks đang có bản ghi trùng (playlist_id, track_id); bỏ qua unique index. Hãy dọn trùng rồi chạy lại.';
    else
      create unique index if not exists playlist_tracks_playlist_track_uniq
        on public.playlist_tracks (playlist_id, track_id);
    end if;
  end if;
end $$;
