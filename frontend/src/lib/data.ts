import { requireSupabase } from "@/lib/supabase";

export type TrackProvider = "spotify" | "licensed";
export type Playlist = { id: string; user_id: string; name: string; description: string; created_at: string; updated_at: string };
export type Favorite = { id: string; user_id: string; provider: TrackProvider; track_id: string; created_at: string };
export type ListeningHistory = { id: string; user_id: string; provider: TrackProvider; track_id: string; listened_seconds: number; played_at: string };
export type Profile = { id: string; display_name: string; created_at: string; updated_at: string };
export type PlaylistItem = { id: string; playlist_id: string; user_id: string; provider: TrackProvider; track_id: string; position: number };

function ensureSuccess(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await requireSupabase().from("profiles").select("id, display_name, created_at, updated_at").eq("id", userId).maybeSingle();
  ensureSuccess(error);
  return data as Profile | null;
}
export async function setDisplayName(userId: string, displayName: string): Promise<void> {
  const client = requireSupabase();
  const { data, error } = await client.from("profiles").update({ display_name: displayName.trim() }).eq("id", userId).select("id").maybeSingle();
  ensureSuccess(error);
  // Hỗ trợ cả tài khoản cũ chưa được backfill profile.
  if (!data) {
    const { error: insertError } = await client.from("profiles").insert({ id: userId, display_name: displayName.trim() });
    ensureSuccess(insertError);
  }
}
export async function listPlaylists(userId: string): Promise<Playlist[]> {
  const { data, error } = await requireSupabase().from("playlists").select("id,user_id,name,description,created_at,updated_at").eq("user_id",userId).order("created_at", { ascending: false });
  ensureSuccess(error); return (data ?? []) as Playlist[];
}
export async function createPlaylist(userId: string, name: string, description = ""): Promise<void> {
  const { error } = await requireSupabase().from("playlists").insert({ user_id: userId, name: name.trim(), description: description.trim() });
  ensureSuccess(error);
}
export async function renamePlaylist(id: string, name: string): Promise<void> {
  const { error } = await requireSupabase().from("playlists").update({ name: name.trim() }).eq("id",id);
  ensureSuccess(error);
}
export async function deletePlaylist(id: string): Promise<void> {
  const { error } = await requireSupabase().from("playlists").delete().eq("id",id);
  ensureSuccess(error);
}
export async function listFavorites(userId: string): Promise<Favorite[]> {
  const { data, error } = await requireSupabase().from("favorites").select("id,user_id,provider,track_id,created_at").eq("user_id",userId).order("created_at", {ascending:false});
  ensureSuccess(error); return (data ?? []) as Favorite[];
}
/** Các bước Spotify/kho nhạc sau sẽ gọi hàm này khi người dùng bấm Yêu thích bài hát thật. */
export async function addFavorite(userId: string, provider: TrackProvider, trackId: string): Promise<void> {
  const { error } = await requireSupabase().from("favorites").insert({user_id:userId,provider,track_id:trackId});
  // Cùng bài hát đã lưu rồi: không tạo bản sao và không yêu cầu quyền UPDATE.
  if (error?.code === "23505") return;
  ensureSuccess(error);
}
export async function removeFavorite(id: string): Promise<void> {
  const { error } = await requireSupabase().from("favorites").delete().eq("id",id);
  ensureSuccess(error);
}
export async function listListeningHistory(userId: string): Promise<ListeningHistory[]> {
  const { data, error } = await requireSupabase().from("listening_history").select("id,user_id,provider,track_id,listened_seconds,played_at").eq("user_id",userId).order("played_at", {ascending:false}).limit(30);
  ensureSuccess(error); return (data ?? []) as ListeningHistory[];
}
export async function recordLicensedPlayback(userId: string, trackId: string, listenedSeconds: number): Promise<void> {
  if (!Number.isSafeInteger(listenedSeconds) || listenedSeconds < 0) throw new Error("Thời lượng không hợp lệ.");
  const { error } = await requireSupabase().from("listening_history").insert({user_id:userId, provider:"licensed",track_id:trackId,listened_seconds:listenedSeconds});
  ensureSuccess(error);
}
export async function addPlaylistItem(userId: string, playlistId: string, provider: TrackProvider, trackId: string, position = 0): Promise<void> {
  const { error } = await requireSupabase().from("playlist_items").insert({user_id:userId,playlist_id:playlistId,provider,track_id:trackId,position});
  ensureSuccess(error);
}
