
"use client";

import { useState } from "react";
import {
  Music2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
} from "lucide-react";
import { useSpotifyPlayer } from "@/components/spotify-player-provider";

function formatTime(milliseconds: number) {
  const seconds = Math.floor(Math.max(0, milliseconds) / 1000);

  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function PlayerBar() {
  const {
    configured,
    authorized,
    ready,
    currentTrack,
    paused,
    position,
    duration,
    volume,
    error,
    connectSpotify,
    togglePlayback,
    nextTrack,
    previousTrack,
    seekTo,
    setVolume,
  } = useSpotifyPlayer();

  const btn =
    "rounded-full p-2 text-mist-300 transition hover:bg-ink-700 hover:text-mist-100 disabled:cursor-not-allowed disabled:opacity-40";

  const canControl =
    authorized && ready && Boolean(currentTrack);

  // Vị trí tạm thời khi người dùng đang kéo thanh tiến trình.
  const [seekPreview, setSeekPreview] = useState<number | null>(null);

  const maxPosition = Math.max(
    1,
    duration || currentTrack?.durationMs || 1
  );

  const displayedPosition = Math.max(
    0,
    Math.min(seekPreview ?? position, maxPosition)
  );

  const commitSeek = (value: number) => {
    setSeekPreview(null);

    void seekTo(value).catch(() => undefined);
  };

  return (
    <div
      role="region"
      aria-label="Trình phát Spotify"
      className="fixed inset-x-0 bottom-0 z-30 flex min-h-16 items-center gap-3 border-t border-ink-700 bg-ink-900 px-3 py-2 sm:gap-4 sm:px-4"
    >
      <div className="flex min-w-0 flex-[1.2] items-center gap-3">
        {currentTrack?.albumImageUrl ? (
          <img
            src={currentTrack.albumImageUrl}
            alt={`Ảnh bìa ${currentTrack.albumName || currentTrack.name}`}
            className="size-10 shrink-0 rounded object-cover"
          />
        ) : (
          <div className="grid size-10 shrink-0 place-items-center rounded bg-ink-700 text-mist-300">
            <Music2 size={18} aria-hidden />
          </div>
        )}

        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {currentTrack?.name ??
              (authorized
                ? ready
                  ? "Chưa có bài hát nào"
                  : "Đang kết nối trình phát…"
                : "Chưa kết nối Spotify")}
          </p>

          <p className="truncate text-xs text-mist-300">
            {currentTrack
              ? currentTrack.artists.join(", ")
              : authorized
                ? "Chọn bài hát để phát trên website"
                : "Kết nối tài khoản Spotify Premium để phát nhạc"}
          </p>

          {error && (
            <p
              title={error}
              className="max-w-[220px] truncate text-[10px] text-red-300 sm:max-w-sm"
            >
              {error}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center gap-1">
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={btn}
            disabled={!canControl}
            onClick={() =>
              void previousTrack().catch(() => undefined)
            }
            aria-label="Bài trước"
          >
            <SkipBack size={17} />
          </button>

          <button
            type="button"
            className={`${btn} bg-mist-100 text-ink-950 hover:bg-white`}
            disabled={!canControl}
            onClick={() =>
              void togglePlayback().catch(() => undefined)
            }
            aria-label={paused ? "Phát nhạc" : "Tạm dừng"}
          >
            {paused ? <Play size={18} /> : <Pause size={18} />}
          </button>

          <button
            type="button"
            className={btn}
            disabled={!canControl}
            onClick={() =>
              void nextTrack().catch(() => undefined)
            }
            aria-label="Bài tiếp theo"
          >
            <SkipForward size={17} />
          </button>
        </div>

        <div className="hidden w-full max-w-md items-center gap-2 text-[10px] text-mist-400 sm:flex">
          <span className="tabular-nums">
            {formatTime(displayedPosition)}
          </span>

          <input
            type="range"
            aria-label="Tua bài hát"
            min={0}
            max={maxPosition}
            step={1000}
            value={displayedPosition}
            disabled={!canControl || maxPosition <= 1}
            onChange={(event) => {
              setSeekPreview(Number(event.currentTarget.value));
            }}
            onPointerUp={(event) => {
              commitSeek(Number(event.currentTarget.value));
            }}
            onKeyUp={(event) => {
              commitSeek(Number(event.currentTarget.value));
            }}
            className="h-1 min-w-0 flex-1 cursor-pointer accent-lime-400 disabled:cursor-not-allowed disabled:opacity-40"
          />

          <span className="tabular-nums">
            {formatTime(duration || currentTrack?.durationMs || 0)}
          </span>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-end gap-2">
        {!authorized ? (
          <button
            type="button"
            disabled={!configured}
            onClick={() =>
              connectSpotify(
                window.location.pathname + window.location.search
              )
            }
            className="whitespace-nowrap rounded-full bg-lime-400 px-3 py-2 text-xs font-semibold text-ink-950 hover:bg-lime-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Kết nối Spotify
          </button>
        ) : (
          <label
            className="hidden items-center gap-2 text-mist-300 md:flex"
            aria-label="Âm lượng"
          >
            <Volume2 size={16} />

            <input
              aria-label="Âm lượng Spotify"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(event) =>
                setVolume(Number(event.target.value))
              }
              className="w-20 accent-lime-400"
            />
          </label>
        )}
      </div>
    </div>
  );
}
