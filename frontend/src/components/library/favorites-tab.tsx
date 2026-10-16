"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Heart, Trash2 } from "lucide-react";
import { errorMessage, removeFavorite } from "@/lib/library-api";
import { libraryKeys, useFavorites } from "@/lib/library-hooks";
import { usePlayTrack } from "@/lib/use-play-track";
import { EmptyBox, ErrorBox, LoadingBox, panelClass, TrackRow } from "@/components/library/track-row";

export function FavoritesTab() {
  const queryClient = useQueryClient();
  const { uid, query } = useFavorites();
  const { play, error: playError } = usePlayTrack();

  const remove = useMutation({
    mutationFn: (id: string) => removeFavorite(id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: libraryKeys.favorites(uid) }),
  });

  const items = query.data ?? [];

  return (
    <section className={panelClass} aria-labelledby="favorites-title">
      <h2 id="favorites-title" className="mb-1 flex items-center gap-2 text-xl font-bold">
        <Heart size={20} className="text-lime-400" aria-hidden /> Bài hát yêu thích
        {query.data && <span className="text-sm font-normal text-mist-300">({items.length})</span>}
      </h2>
      <p className="mb-4 text-sm text-mist-300">
        Chỉ lưu thông tin bài hát (tên, nghệ sĩ, ảnh bìa, liên kết). Website không sao chép âm thanh Spotify.
      </p>

      {playError && <div className="mb-3"><ErrorBox message={playError} /></div>}
      {remove.isError && <div className="mb-3"><ErrorBox message={errorMessage(remove.error, "Không bỏ yêu thích được.")} /></div>}

      {query.isLoading && <LoadingBox text="Đang tải bài hát yêu thích…" />}
      {query.isError && <ErrorBox message={errorMessage(query.error, "Không tải được danh sách yêu thích.")} onRetry={() => void query.refetch()} />}
      {query.isSuccess && items.length === 0 && (
        <EmptyBox title="Chưa có bài hát yêu thích" hint="Bấm biểu tượng trái tim trên thẻ bài hát ở Trang chủ hoặc Tìm kiếm để lưu vào đây." />
      )}

      <ul className="space-y-2">
        {items.map((item) => (
          <TrackRow
            key={item.id}
            provider={item.provider}
            trackId={item.track_id}
            meta={item}
            subtitle={`Thêm ngày ${new Date(item.created_at).toLocaleDateString("vi-VN")}`}
            onPlay={(track) => void play(track)}
            actions={
              <button
                type="button"
                disabled={remove.isPending || item.id.startsWith("pending-")}
                onClick={() => remove.mutate(item.id)}
                aria-label={`Bỏ ${item.track_name ?? "bài hát"} khỏi yêu thích`}
                title="Bỏ yêu thích"
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
