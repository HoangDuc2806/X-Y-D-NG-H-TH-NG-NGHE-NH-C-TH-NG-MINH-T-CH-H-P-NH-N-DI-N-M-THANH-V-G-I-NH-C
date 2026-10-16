"use client";

import { useEffect, useRef, useState } from "react";
import {
  ExternalLink,
  LoaderCircle,
  Music2,
  PlayCircle,
  RefreshCw,
  Search,
  Sparkles,
} from "lucide-react";
import { ApiError, searchSpotifyTracks, type SpotifyTrack } from "@/lib/api";
import { useSpotifyPlayer } from "@/components/spotify-player-provider";

type MusicCategory = {
  id: string;
  label: string;
  query: string;
  description: string;
};

const CATEGORIES: MusicCategory[] = [
  {
    id: "vietnam",
    label: "Nhạc Việt",
    query: "nhạc Việt",
    description: "Tìm các bài hát Việt Nam trong danh mục Spotify.",
  },
  {
    id: "vpop",
    label: "V-Pop",
    query: "V-Pop Việt Nam",
    description: "Nhạc pop Việt Nam và các ca khúc thịnh hành.",
  },
  {
    id: "rap",
    label: "Rap Việt",
    query: "Rap Việt",
    description: "Khám phá rap và hip-hop Việt Nam.",
  },
  {
    id: "chill",
    label: "Nhạc chill",
    query: "Vietnamese chill music",
    description: "Những lựa chọn nhẹ nhàng để học tập và thư giãn.",
  },
  {
    id: "kpop",
    label: "K-Pop",
    query: "K-pop",
    description: "Tìm các ca khúc K-Pop trong danh mục Spotify.",
  },
  {
    id: "global",
    label: "US-UK / Pop",
    query: "global pop hits",
    description: "Pop quốc tế và các bản hit phổ biến.",
  },
];

function formatDuration(durationMs: number) {
  const seconds = Math.floor(Math.max(0, durationMs) / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function MusicLibrary() {
  const [categoryId, setCategoryId] = useState("vietnam");
  const [tracks, setTracks] = useState<SpotifyTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [playError, setPlayError] = useState("");
  const [reloadVersion, setReloadVersion] = useState(0);
  const cacheRef = useRef(new Map<string, SpotifyTrack[]>());

  const {
    authorized,
    ready,
    currentTrack,
    playTrack,
    connectSpotify,
  } = useSpotifyPlayer();

  const category = CATEGORIES.find((item) => item.id === categoryId) ?? CATEGORIES[0]!;

  useEffect(() => {
    const cached = cacheRef.current.get(category.query);
    if (cached) {
      setTracks(cached);
      setLoading(false);
      setError("");
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError("");
    setPlayError("");

    void searchSpotifyTracks(category.query, controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return;
        cacheRef.current.set(category.query, response.items);
        setTracks(response.items);
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return;
        setTracks([]);
        setError(
          caught instanceof ApiError
            ? caught.message
            : "Không thể tải kho nhạc Spotify lúc này. Hãy thử lại."
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [category.query, reloadVersion]);

  async function handlePlay(track: SpotifyTrack) {
    setPlayError("");

    if (!authorized) {
      connectSpotify(window.location.pathname + window.location.search);
      return;
    }

    if (!ready) {
      setPlayError("Spotify đã cấp quyền nhưng trình phát chưa sẵn sàng. Hãy đợi vài giây rồi thử lại.");
      return;
    }

    try {
      await playTrack(track);
    } catch (caught: unknown) {
      setPlayError(
        caught instanceof Error
          ? caught.message
          : "Không thể phát bài hát trên Spotify. Hãy thử lại."
      );
    }
  }

  function reloadCategory() {
    cacheRef.current.delete(category.query);
    setReloadVersion((value) => value + 1);
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-ink-700 bg-ink-900 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-lime-400/10 text-lime-400">
            <Sparkles size={21} aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">Khám phá âm nhạc</h2>
            <p className="mt-1 text-sm leading-relaxed text-mist-300">
              {category.description} Chọn một thể loại bên dưới để tải kết quả trực tiếp từ Spotify.
            </p>
            <p className="mt-2 text-xs text-mist-400">
              {authorized
                ? ready
                  ? "Spotify đã kết nối · Có thể phát trên website"
                  : "Đã cấp quyền Spotify · Đang khởi tạo trình phát"
                : "Có thể xem danh mục; cần kết nối Spotify Premium để phát trực tiếp trên website."}
            </p>
          </div>
          <a
            href="/search"
            className="hidden shrink-0 items-center gap-2 rounded-xl border border-ink-600 px-3 py-2 text-xs font-semibold hover:border-lime-500 sm:inline-flex"
          >
            <Search size={14} /> Tìm kiếm
          </a>
        </div>
      </section>

      <div className="flex flex-wrap gap-2" aria-label="Chọn thể loại nhạc">
        {CATEGORIES.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={categoryId === item.id}
            onClick={() => setCategoryId(item.id)}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
              categoryId === item.id
                ? "border-lime-400 bg-lime-400 text-ink-950"
                : "border-ink-700 bg-ink-900 text-mist-300 hover:border-ink-500 hover:text-mist-100"
            }`}
          >
            {item.label}
          </button>
        ))}
        <button
          type="button"
          onClick={reloadCategory}
          disabled={loading}
          className="ml-auto inline-flex items-center gap-2 rounded-full border border-ink-700 px-3 py-2 text-sm text-mist-300 hover:border-ink-500 disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Tải lại
        </button>
      </div>

      {playError && (
        <div role="alert" className="rounded-xl border border-red-800/70 bg-red-950/30 p-4 text-sm text-red-200">
          {playError}
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-3 rounded-xl border border-ink-700 bg-ink-900 p-6 text-sm text-mist-300">
          <LoaderCircle size={18} className="animate-spin" />
          Đang tải bài hát từ Spotify…
        </div>
      )}

      {!loading && error && (
        <div role="alert" className="rounded-xl border border-red-800/70 bg-red-950/30 p-5 text-sm text-red-200">
          <p>{error}</p>
          <button type="button" onClick={reloadCategory} className="mt-3 rounded-lg border border-red-700 px-3 py-2 font-medium hover:bg-red-900/40">
            Thử lại
          </button>
        </div>
      )}

      {!loading && !error && tracks.length === 0 && (
        <div className="rounded-xl border border-dashed border-ink-700 p-8 text-center">
          <Music2 size={28} className="mx-auto mb-3 text-mist-400" />
          <p className="font-medium">Chưa tìm thấy bài hát trong mục này</p>
          <p className="mt-1 text-sm text-mist-300">Chọn thể loại khác hoặc thử tìm kiếm tên bài hát cụ thể.</p>
        </div>
      )}

      {!loading && !error && tracks.length > 0 && (
        <section aria-label={`Bài hát: ${category.label}`}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">{category.label}</h3>
              <p className="text-xs text-mist-400">{tracks.length} kết quả · Danh mục Spotify Việt Nam</p>
            </div>
            <a href="https://open.spotify.com/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-xs font-semibold text-mist-300 hover:text-lime-400">
              Spotify <ExternalLink size={13} />
            </a>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {tracks.map((track) => {
              const isCurrentTrack = currentTrack?.uri === track.uri;
              const releaseYear = track.release_date?.slice(0, 4);

              return (
                <article
                  key={track.id}
                  className={`overflow-hidden rounded-2xl border bg-ink-900 transition ${
                    isCurrentTrack ? "border-lime-500" : "border-ink-700 hover:border-ink-500"
                  }`}
                >
                  <div className="flex gap-3 p-3">
                    {track.album_image_url ? (
                      <img
                        src={track.album_image_url}
                        alt={`Ảnh bìa ${track.album_name ?? track.name}`}
                        className="size-20 shrink-0 rounded-xl object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="grid size-20 shrink-0 place-items-center rounded-xl bg-ink-800 text-mist-400">
                        <Music2 size={25} aria-hidden />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h4 className="line-clamp-2 font-semibold leading-snug">{track.name}</h4>
                      <p className="mt-1 line-clamp-2 text-sm text-mist-300">
                        {track.artists.join(", ") || "Chưa rõ nghệ sĩ"}
                      </p>
                      <p className="mt-1 line-clamp-1 text-xs text-mist-400">
                        {track.album_name ?? "Chưa rõ album"} · {formatDuration(track.duration_ms)}{releaseYear ? ` · ${releaseYear}` : ""}
                      </p>
                      {isCurrentTrack && (
                        <p className="mt-1 text-xs font-medium text-lime-400">
                          Đang phát trong Music Discovery
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 border-t border-ink-700 p-3">
                    <button
                      type="button"
                      onClick={() => void handlePlay(track)}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-lime-400 px-3 py-2 text-sm font-semibold text-ink-950 hover:bg-lime-300"
                    >
                      <PlayCircle size={16} />
                      {!authorized ? "Kết nối để phát" : isCurrentTrack ? "Phát lại bài này" : "Phát trên website"}
                    </button>
                    <a
                      href={track.spotify_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-1 rounded-lg border border-ink-600 px-3 py-2 text-sm hover:border-lime-500"
                      aria-label={`Mở ${track.name} trên Spotify`}
                    >
                      Spotify <ExternalLink size={13} />
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <p className="text-xs leading-relaxed text-mist-400">
        Dữ liệu bài hát và ảnh bìa được lấy từ Spotify, có liên kết mở bản gốc. Music Discovery Vietnam không tải xuống hoặc lưu trữ tệp âm thanh Spotify. Phát trực tiếp yêu cầu tài khoản Spotify Premium và quyền truy cập phù hợp.
      </p>
    </div>
  );
}
