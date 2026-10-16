"use client";

import { useEffect, useState } from "react";
import { ExternalLink, LoaderCircle, Music2, PlayCircle, Search } from "lucide-react";
import { ApiError, searchSpotifyTracks, type SpotifyTrack } from "@/lib/api";
import { useSpotifyPlayer } from "@/components/spotify-player-provider";

function formatDuration(durationMs: number) {
  const totalSeconds = Math.floor(durationMs / 1000);
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

export function SpotifySearch({ initialQuery }: { initialQuery: string }) {
  const [tracks, setTracks] = useState<SpotifyTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [playError, setPlayError] = useState("");
  const [searchedQuery, setSearchedQuery] = useState("");
  const { authorized, ready, currentTrack, playTrack, connectSpotify } = useSpotifyPlayer();

  useEffect(() => {
    const query = initialQuery.trim();
    setSearchedQuery(query);
    setTracks([]);
    setError("");
    setPlayError("");
    if (!query) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    void searchSpotifyTracks(query, controller.signal)
      .then((response) => setTracks(response.items))
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return;
        setError(caught instanceof ApiError ? caught.message : "Không thể tìm kiếm trên Spotify lúc này.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [initialQuery]);

  async function handlePlay(track: SpotifyTrack) {
    setPlayError("");
    if (!authorized) {
      connectSpotify(window.location.pathname + window.location.search);
      return;
    }
    if (!ready) {
      setPlayError("Trình phát Spotify đang kết nối. Hãy đợi vài giây rồi thử lại.");
      return;
    }
    try {
      await playTrack(track);
    } catch (caught) {
      setPlayError(caught instanceof Error ? caught.message : "Không thể phát bài hát trên Spotify.");
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-ink-700 bg-ink-900 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-lime-400/10 text-lime-400"><Search size={21} /></div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">Danh mục Spotify</h2>
            <p className="mt-1 text-sm leading-relaxed text-mist-300">
              {searchedQuery ? <>Kết quả cho <span className="font-medium text-mist-100">“{searchedQuery}”</span></> : "Nhập tên bài hát, nghệ sĩ hoặc album vào ô tìm kiếm phía trên."}
            </p>
            <p className="mt-2 text-xs text-mist-400">{authorized ? (ready ? "Spotify đã kết nối · Có thể phát nhạc trên website" : "Đã cấp quyền · Đang khởi tạo trình phát") : "Kết nối tài khoản Spotify Premium để phát nhạc trực tiếp trên website."}</p>
          </div>
          {!authorized && <button type="button" onClick={() => connectSpotify(window.location.pathname + window.location.search)} className="shrink-0 rounded-xl bg-lime-400 px-3 py-2 text-xs font-semibold text-ink-950 hover:bg-lime-300">Kết nối</button>}
        </div>
      </div>

      {playError && <div role="alert" className="rounded-xl border border-red-800/70 bg-red-950/30 p-4 text-sm text-red-200">{playError}</div>}
      {loading && <div className="flex items-center gap-2 rounded-xl border border-ink-700 p-5 text-sm text-mist-300"><LoaderCircle size={18} className="animate-spin" /> Đang tìm trong danh mục Spotify…</div>}
      {error && <div role="alert" className="rounded-xl border border-red-800/70 bg-red-950/30 p-4 text-sm text-red-200">{error}</div>}
      {!loading && !error && !searchedQuery && <div className="rounded-xl border border-dashed border-ink-700 p-8 text-center text-sm text-mist-300">Dùng thanh tìm kiếm ở phía trên để tìm nhạc trên Spotify.</div>}
      {!loading && !error && searchedQuery && tracks.length === 0 && <div className="rounded-xl border border-dashed border-ink-700 p-8 text-center"><Music2 size={26} className="mx-auto mb-3 text-mist-400" /><p className="font-medium">Không tìm thấy bài hát</p><p className="mt-1 text-sm text-mist-300">Thử tên bài hát hoặc nghệ sĩ khác.</p></div>}

      {tracks.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {tracks.map((track) => {
            const isPlaying = currentTrack?.uri === track.uri;
            return (
              <article key={track.id} className={`overflow-hidden rounded-2xl border bg-ink-900 transition ${isPlaying ? "border-lime-500" : "border-ink-700 hover:border-ink-500"}`}>
                <div className="flex gap-3 p-3">
                  {track.album_image_url ? <img src={track.album_image_url} alt={`Ảnh bìa ${track.album_name ?? track.name}`} className="size-20 shrink-0 rounded-xl object-cover" /> : <div className="grid size-20 shrink-0 place-items-center rounded-xl bg-ink-800 text-mist-400"><Music2 size={25} /></div>}
                  <div className="min-w-0 flex-1">
                    <h3 className="line-clamp-2 font-semibold leading-snug">{track.name}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-mist-300">{track.artists.join(", ") || "Chưa rõ nghệ sĩ"}</p>
                    <p className="mt-1 line-clamp-1 text-xs text-mist-400">{track.album_name ?? "Chưa rõ album"} · {formatDuration(track.duration_ms)}</p>
                    {isPlaying && <p className="mt-1 text-xs font-medium text-lime-400">Đang phát</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 border-t border-ink-700 p-3">
                  <button type="button" onClick={() => void handlePlay(track)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-lime-400 px-3 py-2 text-sm font-semibold text-ink-950 hover:bg-lime-300"><PlayCircle size={16} />{authorized ? (isPlaying ? "Phát lại bài này" : "Phát trên website") : "Kết nối để phát"}</button>
                  <a href={track.spotify_url} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-1 rounded-lg border border-ink-600 px-3 py-2 text-sm hover:border-lime-500" aria-label={`Mở ${track.name} trên Spotify`}>Spotify <ExternalLink size={13} /></a>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <p className="text-xs leading-relaxed text-mist-400">Nhạc được phát từ Spotify qua Web Playback SDK; website không tải xuống hoặc lưu tệp âm thanh Spotify. Mỗi người nghe cần tự cấp quyền cho tài khoản Spotify của mình.</p>
    </div>
  );
}
