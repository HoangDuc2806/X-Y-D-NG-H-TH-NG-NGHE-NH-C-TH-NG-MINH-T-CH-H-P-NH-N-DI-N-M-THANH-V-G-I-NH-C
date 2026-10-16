"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Disc3, ListMusic, PencilLine, Plus, Trash2, X } from "lucide-react";
import {
  createPlaylist,
  deletePlaylist,
  errorMessage,
  listPlaylistTracks,
  removePlaylistTrack,
  renamePlaylist,
  type PlaylistSummary,
} from "@/lib/library-api";
import { libraryKeys, usePlaylists } from "@/lib/library-hooks";
import { useAuth } from "@/components/providers";
import { usePlayTrack } from "@/lib/use-play-track";
import { EmptyBox, ErrorBox, LoadingBox, panelClass, TrackRow } from "@/components/library/track-row";

const nameSchema = z.object({
  name: z.string().trim().min(1, "Tên playlist không được để trống.").max(100, "Tên playlist tối đa 100 ký tự."),
});
type NameFields = z.infer<typeof nameSchema>;

const inputClass =
  "w-full rounded-xl border border-ink-700 bg-ink-950 px-4 py-3 text-sm focus:border-lime-400 focus:outline-none";

export function PlaylistsTab() {
  const { user } = useAuth();
  const uid = user?.id;
  const queryClient = useQueryClient();
  const playlists = usePlaylists();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const refreshPlaylists = () => queryClient.invalidateQueries({ queryKey: libraryKeys.playlists(uid) });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<NameFields>({
    resolver: zodResolver(nameSchema),
  });
  const create = useMutation({
    mutationFn: (values: NameFields) => createPlaylist(values.name),
    onSuccess: () => {
      reset({ name: "" });
      return refreshPlaylists();
    },
  });

  const selected = playlists.data?.find((item) => item.id === selectedId);

  if (selectedId) {
    return (
      <PlaylistDetail
        playlistId={selectedId}
        playlist={selected}
        listLoaded={playlists.isSuccess}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
      <section className={panelClass} aria-labelledby="create-playlist-title">
        <h2 id="create-playlist-title" className="flex items-center gap-2 text-xl font-bold">
          <Plus size={20} className="text-lime-400" aria-hidden /> Tạo playlist
        </h2>
        <p className="mb-5 mt-2 text-sm text-mist-300">
          Sau khi tạo, dùng nút “Thêm vào playlist” trên thẻ bài hát ở Trang chủ hoặc Tìm kiếm để thêm nhạc.
        </p>
        <form onSubmit={handleSubmit((values) => create.mutate(values))} className="space-y-3">
          <label htmlFor="playlist-name" className="text-sm font-medium">Tên playlist</label>
          <input id="playlist-name" placeholder="Ví dụ: Nhạc khi học bài" maxLength={100} {...register("name")} className={inputClass} />
          {errors.name && <p role="alert" className="text-sm text-red-300">{errors.name.message}</p>}
          {create.isError && <p role="alert" className="text-sm text-red-300">{errorMessage(create.error, "Không tạo được playlist.")}</p>}
          <button type="submit" disabled={create.isPending} className="rounded-xl bg-lime-400 px-5 py-2.5 text-sm font-semibold text-ink-950 disabled:opacity-60">
            {create.isPending ? "Đang tạo…" : "Tạo playlist"}
          </button>
        </form>
      </section>

      <section className={panelClass} aria-labelledby="playlist-list-title">
        <h2 id="playlist-list-title" className="mb-4 flex items-center gap-2 text-xl font-bold">
          <ListMusic size={20} className="text-lime-400" aria-hidden /> Playlist của bạn
        </h2>
        {playlists.isLoading && <LoadingBox text="Đang tải playlist…" />}
        {playlists.isError && <ErrorBox message={errorMessage(playlists.error, "Không tải được playlist.")} onRetry={() => void playlists.refetch()} />}
        {playlists.isSuccess && playlists.data.length === 0 && (
          <EmptyBox title="Bạn chưa tạo playlist nào" hint="Nhập tên ở bên trái để tạo playlist đầu tiên." />
        )}
        <ul className="space-y-3">
          {playlists.data?.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setSelectedId(item.id)}
                aria-label={`Mở playlist ${item.name}`}
                className="flex w-full items-center gap-3 rounded-xl border border-ink-700 bg-ink-950 p-4 text-left hover:border-lime-500"
              >
                <span className="rounded-lg bg-ink-800 p-3 text-lime-400"><Disc3 size={22} aria-hidden /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{item.name}</span>
                  <span className="block text-xs text-mist-300">
                    {item.track_count ?? 0} bài hát · Tạo {new Date(item.created_at).toLocaleDateString("vi-VN")}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function PlaylistDetail({
  playlistId,
  playlist,
  listLoaded,
  onBack,
}: {
  playlistId: string;
  playlist: PlaylistSummary | undefined;
  listLoaded: boolean;
  onBack: () => void;
}) {
  const { user } = useAuth();
  const uid = user?.id;
  const queryClient = useQueryClient();
  const { play, error: playError } = usePlayTrack();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState("");

  const tracks = useQuery({
    queryKey: libraryKeys.playlistTracks(uid, playlistId),
    queryFn: ({ signal }) => listPlaylistTracks(playlistId, signal),
    enabled: Boolean(uid),
  });

  const refreshAll = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: libraryKeys.playlists(uid) }),
      queryClient.invalidateQueries({ queryKey: libraryKeys.playlistTracks(uid, playlistId) }),
    ]);

  const rename = useMutation({
    mutationFn: (value: string) => renamePlaylist(playlistId, value),
    onSuccess: async () => {
      setEditing(false);
      await refreshAll();
    },
  });
  const removePlaylist = useMutation({
    mutationFn: () => deletePlaylist(playlistId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: libraryKeys.playlists(uid) });
      onBack();
    },
  });
  const removeTrack = useMutation({
    mutationFn: (rowId: string) => removePlaylistTrack(playlistId, rowId),
    onSettled: refreshAll,
  });

  if (listLoaded && !playlist && !removePlaylist.isSuccess) {
    return (
      <section className={panelClass}>
        <button type="button" onClick={onBack} className="mb-4 inline-flex items-center gap-2 text-sm text-mist-300 hover:text-lime-400">
          <ArrowLeft size={16} aria-hidden /> Quay lại danh sách
        </button>
        <ErrorBox message="Playlist này không còn tồn tại." />
      </section>
    );
  }

  function submitRename() {
    const parsed = nameSchema.safeParse({ name });
    if (!parsed.success) {
      setNameError(parsed.error.issues[0]?.message ?? "Tên không hợp lệ.");
      return;
    }
    setNameError("");
    rename.mutate(parsed.data.name);
  }

  function onDelete() {
    if (!window.confirm("Xóa playlist này? Các bài hát trong playlist cũng sẽ bị xóa khỏi playlist.")) return;
    removePlaylist.mutate();
  }

  const items = tracks.data ?? [];
  const mutationError = rename.error ?? removePlaylist.error ?? removeTrack.error;

  return (
    <section className={panelClass} aria-labelledby="playlist-detail-title">
      <button type="button" onClick={onBack} className="mb-4 inline-flex items-center gap-2 text-sm text-mist-300 hover:text-lime-400">
        <ArrowLeft size={16} aria-hidden /> Quay lại danh sách
      </button>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        {editing ? (
          <div className="min-w-0 flex-1">
            <div className="flex gap-2">
              <input
                value={name}
                maxLength={100}
                aria-label="Tên playlist mới"
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && submitRename()}
                className="min-w-0 flex-1 rounded-lg bg-ink-800 px-3 py-2 text-sm"
              />
              <button type="button" disabled={rename.isPending} onClick={submitRename} className="rounded-lg bg-lime-400 px-3 py-2 text-xs font-bold text-ink-950 disabled:opacity-60">Lưu</button>
              <button type="button" onClick={() => { setEditing(false); setNameError(""); }} aria-label="Hủy đổi tên" className="rounded-lg p-2 hover:bg-ink-800"><X size={16} aria-hidden /></button>
            </div>
            {nameError && <p role="alert" className="mt-2 text-sm text-red-300">{nameError}</p>}
          </div>
        ) : (
          <div className="min-w-0">
            <h2 id="playlist-detail-title" className="truncate text-2xl font-bold">{playlist?.name ?? "Playlist"}</h2>
            <p className="text-sm text-mist-300">{tracks.isSuccess ? items.length : (playlist?.track_count ?? 0)} bài hát</p>
          </div>
        )}
        {!editing && (
          <div className="flex gap-2">
            <button type="button" onClick={() => { setName(playlist?.name ?? ""); setEditing(true); }} className="inline-flex items-center gap-2 rounded-lg border border-ink-600 px-3 py-2 text-sm hover:border-lime-500">
              <PencilLine size={15} aria-hidden /> Đổi tên
            </button>
            <button type="button" disabled={removePlaylist.isPending} onClick={onDelete} className="inline-flex items-center gap-2 rounded-lg border border-red-800/70 px-3 py-2 text-sm text-red-300 hover:bg-red-950/30 disabled:opacity-50">
              <Trash2 size={15} aria-hidden /> Xóa playlist
            </button>
          </div>
        )}
      </div>

      {playError && <div className="mb-3"><ErrorBox message={playError} /></div>}
      {mutationError && <div className="mb-3"><ErrorBox message={errorMessage(mutationError, "Không cập nhật được playlist.")} /></div>}

      {tracks.isLoading && <LoadingBox text="Đang tải bài hát trong playlist…" />}
      {tracks.isError && <ErrorBox message={errorMessage(tracks.error, "Không tải được bài hát trong playlist.")} onRetry={() => void tracks.refetch()} />}
      {tracks.isSuccess && items.length === 0 && (
        <EmptyBox title="Playlist đang trống" hint="Dùng nút “Thêm vào playlist” trên thẻ bài hát ở Trang chủ hoặc Tìm kiếm." />
      )}

      <ul className="space-y-2">
        {items.map((item) => (
          <TrackRow
            key={item.id}
            provider="spotify"
            trackId={item.track_id}
            meta={item}
            onPlay={(track) => void play(track)}
            actions={
              <button
                type="button"
                disabled={removeTrack.isPending}
                onClick={() => removeTrack.mutate(item.id)}
                aria-label={`Xóa ${item.track_name ?? "bài hát"} khỏi playlist`}
                title="Xóa khỏi playlist"
                className="rounded-lg p-2 text-red-300 hover:bg-ink-800 disabled:opacity-50"
              >
                <Trash2 size={18} aria-hidden />
              </button>
            }
          />
        ))}
      </ul>
    </section>
  );
}
