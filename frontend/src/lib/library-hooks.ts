"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/components/providers";
import type { SpotifyTrack } from "@/lib/api";
import {
  addFavorite,
  favoriteKey,
  listAllFavorites,
  listHistory,
  listPlaylists,
  removeFavorite,
  type FavoriteItem,
} from "@/lib/library-api";

export const libraryKeys = {
  favorites: (uid?: string) => ["favorites", uid] as const,
  history: (uid?: string) => ["history", uid] as const,
  playlists: (uid?: string) => ["playlists", uid] as const,
  playlistTracks: (uid: string | undefined, playlistId: string) => ["playlist-tracks", uid, playlistId] as const,
};

export function useFavorites() {
  const { user } = useAuth();
  const uid = user?.id;
  const query = useQuery({
    queryKey: libraryKeys.favorites(uid),
    queryFn: ({ signal }) => listAllFavorites(signal),
    enabled: Boolean(uid),
  });
  const byKey = useMemo(() => {
    const map = new Map<string, FavoriteItem>();
    for (const item of query.data ?? []) map.set(favoriteKey(item.provider, item.track_id), item);
    return map;
  }, [query.data]);
  return { uid, query, byKey };
}

export function useHistory() {
  const { user } = useAuth();
  const uid = user?.id;
  return useQuery({
    queryKey: libraryKeys.history(uid),
    queryFn: ({ signal }) => listHistory(signal),
    enabled: Boolean(uid),
  });
}

/** `enabled=false` cho phép tải trễ (ví dụ chỉ khi mở menu "Thêm vào playlist"). */
export function usePlaylists(enabled = true) {
  const { user } = useAuth();
  const uid = user?.id;
  return useQuery({
    queryKey: libraryKeys.playlists(uid),
    queryFn: ({ signal }) => listPlaylists(signal),
    enabled: Boolean(uid) && enabled,
  });
}

export type ToggleFavoriteInput = {
  track: SpotifyTrack;
  /** id dòng yêu thích hiện có (đã lưu thật) nếu bài đang được yêu thích; null nếu chưa. */
  existingId: string | null;
};

/**
 * Bật/tắt yêu thích một bài Spotify, cập nhật trái tim ngay (optimistic) và hoàn tác nếu lỗi.
 * Việc "thêm hay xóa" được quyết định lúc bấm (existingId), không đọc lại cache giữa chừng.
 */
export function useToggleFavorite() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const uid = user?.id;

  return useMutation({
    mutationFn: async ({ track, existingId }: ToggleFavoriteInput) => {
      if (existingId) {
        await removeFavorite(existingId);
        return { added: false as const };
      }
      return { added: true as const, item: await addFavorite(track) };
    },
    onMutate: async ({ track, existingId }) => {
      const key = libraryKeys.favorites(uid);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<FavoriteItem[]>(key);
      queryClient.setQueryData<FavoriteItem[]>(key, (current = []) =>
        existingId
          ? current.filter((item) => !(item.provider === "spotify" && item.track_id === track.id))
          : [
              {
                id: `pending-${track.id}`,
                user_id: uid ?? "",
                provider: "spotify",
                track_id: track.id,
                track_name: track.name,
                artist_name: track.artists.join(", "),
                album_name: track.album_name,
                cover_url: track.album_image_url,
                spotify_url: track.spotify_url,
                created_at: new Date().toISOString(),
              },
              ...current,
            ],
      );
      return { previous };
    },
    onError: (_error, _input, context) => {
      queryClient.setQueryData(libraryKeys.favorites(uid), context?.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: libraryKeys.favorites(uid) }),
  });
}
