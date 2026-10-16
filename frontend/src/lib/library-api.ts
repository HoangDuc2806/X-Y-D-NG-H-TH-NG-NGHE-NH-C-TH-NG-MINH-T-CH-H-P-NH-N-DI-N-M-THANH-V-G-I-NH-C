/**
 * Client gọi backend FastAPI cho Thư viện (yêu thích, lịch sử, playlist).
 * Mọi request đều mang access token Supabase của người dùng hiện tại.
 * Không có service-role key hay secret nào ở đây.
 */
import { API_URL, ApiError, type SpotifyTrack } from "@/lib/api";
import { getSupabaseClient } from "@/lib/supabase";

export type TrackProvider = "spotify" | "licensed";

/** Metadata hiển thị đã lưu; có thể null với dữ liệu cũ. */
export type SavedTrackMeta = {
  track_name: string | null;
  artist_name: string | null;
  album_name: string | null;
  cover_url: string | null;
  spotify_url: string | null;
};

export type FavoriteItem = SavedTrackMeta & {
  id: string;
  user_id: string;
  provider: TrackProvider;
  track_id: string;
  created_at: string;
};

export type HistoryItem = SavedTrackMeta & {
  id: string;
  user_id: string;
  provider: TrackProvider;
  track_id: string;
  listened_seconds: number;
  played_at: string;
};

export type PlaylistSummary = {
  id: string;
  user_id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
  track_count: number | null;
};

export type PlaylistTrackItem = SavedTrackMeta & {
  id: string;
  playlist_id: string;
  track_id: string;
  position: number | null;
  created_at: string | null;
};

/** Phần metadata gửi lên backend khi lưu bài hát. */
export type TrackMetaInput = {
  track_name?: string;
  artist_name?: string;
  album_name?: string;
  cover_url?: string;
  spotify_url?: string;
};

export const spotifyTrackUrl = (id: string) => `https://open.spotify.com/track/${encodeURIComponent(id)}`;

function httpsOnly(url: string | null | undefined): string | undefined {
  return url && url.toLowerCase().startsWith("https://") ? url : undefined;
}

/** Cắt theo giới hạn của backend để một tiêu đề quá dài không làm cả yêu cầu bị từ chối (422). */
function clip(text: string | null | undefined, max: number): string | undefined {
  const value = text?.trim();
  return value ? value.slice(0, max) : undefined;
}

export function metaFromSpotifyTrack(track: SpotifyTrack): TrackMetaInput {
  return {
    track_name: clip(track.name, 200),
    artist_name: clip(track.artists.join(", "), 500),
    album_name: clip(track.album_name, 200),
    cover_url: httpsOnly(track.album_image_url),
    spotify_url: httpsOnly(track.spotify_url),
  };
}

/** Metadata lấy từ trạng thái Spotify Web Playback SDK (chỉ văn bản và URL ảnh bìa). */
export function metaFromSdkTrack(track: SpotifyTrackLike, trackId: string): TrackMetaInput {
  return {
    track_name: clip(track.name, 200),
    artist_name: clip(track.artists?.map((artist) => artist.name).join(", "), 500),
    album_name: clip(track.album?.name, 200),
    cover_url: httpsOnly(track.album?.images?.[0]?.url),
    spotify_url: spotifyTrackUrl(trackId),
  };
}

type SpotifyTrackLike = {
  name: string;
  artists?: Array<{ name: string }>;
  album?: { name: string; images?: Array<{ url: string }> };
};

/** Dựng lại SpotifyTrack từ dữ liệu đã lưu để phát bằng trình phát hiện tại. */
export function savedToSpotifyTrack(item: { track_id: string } & Partial<SavedTrackMeta>): SpotifyTrack {
  return {
    id: item.track_id,
    name: item.track_name ?? "Bài hát Spotify",
    artists: item.artist_name ? [item.artist_name] : [],
    album_name: item.album_name ?? null,
    album_image_url: item.cover_url ?? null,
    release_date: null,
    duration_ms: 0, // SDK sẽ cập nhật độ dài thật khi phát
    spotify_url: item.spotify_url ?? spotifyTrackUrl(item.track_id),
    uri: `spotify:track:${item.track_id}`,
  };
}

async function accessToken(): Promise<string> {
  const client = getSupabaseClient();
  if (!client) throw new ApiError("Chưa cấu hình Supabase trong frontend/.env.local.");
  const { data } = await client.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new ApiError("Bạn cần đăng nhập để tiếp tục.", 401);
  return token;
}

async function request<T>(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const token = await accessToken();
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal,
    });
  } catch (caught) {
    if (signal?.aborted) throw caught;
    throw new ApiError("Không kết nối được tới máy chủ. Hãy kiểm tra backend đang chạy.");
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: { message?: string }; detail?: string }
      | null;
    const fallback =
      response.status === 401
        ? "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại."
        : "Máy chủ không xử lý được yêu cầu.";
    throw new ApiError(payload?.error?.message ?? (typeof payload?.detail === "string" ? payload.detail : fallback), response.status);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** Ghi lịch sử là việc phụ: không có phiên đăng nhập thì bỏ qua êm (không phải lỗi). */
export async function hasSession(): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;
  const { data } = await client.auth.getSession();
  return Boolean(data.session?.access_token);
}

// ---------- Yêu thích ----------
const FAVORITE_PAGE = 100;
const FAVORITE_MAX_PAGES = 30;

/** Lấy toàn bộ yêu thích (phân trang theo offset) để số lượng và trạng thái trái tim luôn đúng. */
export async function listAllFavorites(signal?: AbortSignal): Promise<FavoriteItem[]> {
  const all: FavoriteItem[] = [];
  for (let page = 0; page < FAVORITE_MAX_PAGES; page += 1) {
    const rows = await request<FavoriteItem[]>(
      "GET",
      `/api/favorites?limit=${FAVORITE_PAGE}&offset=${page * FAVORITE_PAGE}`,
      undefined,
      signal,
    );
    all.push(...rows);
    if (rows.length < FAVORITE_PAGE) break;
  }
  return all;
}

export const addFavorite = (track: SpotifyTrack) =>
  request<FavoriteItem>("POST", "/api/favorites", {
    provider: "spotify" satisfies TrackProvider,
    track_id: track.id,
    ...metaFromSpotifyTrack(track),
  });

export const removeFavorite = (favoriteId: string) => request<void>("DELETE", `/api/favorites/${favoriteId}`);

export const favoriteKey = (provider: TrackProvider, trackId: string) => `${provider}:${trackId}`;

// ---------- Lịch sử ----------
export const HISTORY_PAGE_SIZE = 50;

export const listHistory = (signal?: AbortSignal) =>
  request<HistoryItem[]>("GET", `/api/listening-history?limit=${HISTORY_PAGE_SIZE}`, undefined, signal);

export type HistoryInput = TrackMetaInput & { provider: TrackProvider; track_id: string; listened_seconds?: number };

export const recordHistory = (input: HistoryInput) => request<HistoryItem>("POST", "/api/listening-history", input);

export const deleteHistoryItem = (id: string) => request<void>("DELETE", `/api/listening-history/${id}`);

export const clearHistory = () => request<void>("DELETE", "/api/listening-history");

// ---------- Playlist ----------
export const listPlaylists = (signal?: AbortSignal) => request<PlaylistSummary[]>("GET", "/api/playlists", undefined, signal);

export const createPlaylist = (name: string) => request<PlaylistSummary>("POST", "/api/playlists", { name });

export const renamePlaylist = (id: string, name: string) => request<PlaylistSummary>("PATCH", `/api/playlists/${id}`, { name });

export const deletePlaylist = (id: string) => request<void>("DELETE", `/api/playlists/${id}`);

export const listPlaylistTracks = (id: string, signal?: AbortSignal) =>
  request<PlaylistTrackItem[]>("GET", `/api/playlists/${id}/tracks`, undefined, signal);

export const addPlaylistTrack = (playlistId: string, track: SpotifyTrack, position: number) =>
  request<PlaylistTrackItem>("POST", `/api/playlists/${playlistId}/tracks`, {
    track_id: track.id,
    position,
    ...metaFromSpotifyTrack(track),
  });

export const removePlaylistTrack = (playlistId: string, rowId: string) =>
  request<void>("DELETE", `/api/playlists/${playlistId}/tracks/${rowId}`);

export function errorMessage(caught: unknown, fallback = "Đã xảy ra lỗi. Hãy thử lại."): string {
  return caught instanceof Error && caught.message ? caught.message : fallback;
}
