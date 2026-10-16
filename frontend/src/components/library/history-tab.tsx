"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { History, Trash2 } from "lucide-react";
import { clearHistory, deleteHistoryItem, errorMessage, HISTORY_PAGE_SIZE } from "@/lib/library-api";
import { libraryKeys, useHistory } from "@/lib/library-hooks";
import { useAuth } from "@/components/providers";
import { usePlayTrack } from "@/lib/use-play-track";
import { EmptyBox, ErrorBox, LoadingBox, panelClass, TrackRow } from "@/components/library/track-row";

function formatPlayedAt(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("vi-VN");
}

export function HistoryTab() {
  const { user } = useAuth();
  const uid = user?.id;
  const queryClient = useQueryClient();
  const query = useHistory();
  const { play, error: playError } = usePlayTrack();

  const refresh = () => queryClient.invalidateQueries({ queryKey: libraryKeys.history(uid) });
  const removeOne = useMutation({ mutationFn: (id: string) => deleteHistoryItem(id), onSettled: refresh });
  const removeAll = useMutation({ mutationFn: () => clearHistory(), onSettled: refresh });

  const items = query.data ?? [];
  const mutationError = removeOne.error ?? removeAll.error;

  function onClearAll() {
    if (!window.confirm("Xóa toàn bộ lịch sử nghe? Thao tác này không thể hoàn tác.")) return;
    removeAll.mutate();
  }

  return (
    <section className={panelClass} aria-labelledby="history-title">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h2 id="history-title" className="flex items-center gap-2 text-xl font-bold">
          <History size={20} className="text-lime-400" aria-hidden /> Đã nghe gần đây
        </h2>
        {items.length > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            disabled={removeAll.isPending}
            className="inline-flex items-center gap-2 rounded-lg border border-red-800/70 px-3 py-2 text-sm text-red-300 hover:bg-red-950/30 disabled:opacity-50"
          >
            <Trash2 size={15} aria-hidden /> {removeAll.isPending ? "Đang xóa…" : "Xóa toàn bộ lịch sử"}
          </button>
        )}
      </div>
      <p className="mb-4 text-sm text-mist-300">
        Mỗi lượt nghe được ghi khi bài hát thực sự phát trên website lúc bạn đã đăng nhập. Chỉ hiển thị {HISTORY_PAGE_SIZE} lượt mới nhất.
      </p>

      {playError && <div className="mb-3"><ErrorBox message={playError} /></div>}
      {mutationError && <div className="mb-3"><ErrorBox message={errorMessage(mutationError, "Không xóa được lịch sử.")} /></div>}

      {query.isLoading && <LoadingBox text="Đang tải lịch sử nghe…" />}
      {query.isError && <ErrorBox message={errorMessage(query.error, "Không tải được lịch sử nghe.")} onRetry={() => void query.refetch()} />}
      {query.isSuccess && items.length === 0 && (
        <EmptyBox title="Chưa có lượt nghe nào" hint="Phát một bài hát bằng trình phát Spotify của website, lượt nghe sẽ xuất hiện ở đây." />
      )}

      <ul className="space-y-2">
        {items.map((item) => (
          <TrackRow
            key={item.id}
            provider={item.provider}
            trackId={item.track_id}
            meta={item}
            subtitle={formatPlayedAt(item.played_at)}
            onPlay={(track) => void play(track)}
            actions={
              <button
                type="button"
                disabled={removeOne.isPending}
                onClick={() => removeOne.mutate(item.id)}
                aria-label={`Xóa lượt nghe ${item.track_name ?? "này"}`}
                title="Xóa lượt nghe"
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
