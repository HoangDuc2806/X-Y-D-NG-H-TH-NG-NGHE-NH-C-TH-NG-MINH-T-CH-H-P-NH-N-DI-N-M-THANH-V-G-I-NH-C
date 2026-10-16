"use client";

import type { ReactNode } from "react";
import { ExternalLink, Music2, PlayCircle } from "lucide-react";
import type { SpotifyTrack } from "@/lib/api";
import { useSpotifyPlayer } from "@/components/spotify-player-provider";
import { savedToSpotifyTrack, spotifyTrackUrl, type SavedTrackMeta, type TrackProvider } from "@/lib/library-api";

type TrackRowProps = {
  provider: TrackProvider;
  trackId: string;
  meta: SavedTrackMeta;
  subtitle?: string;
  onPlay: (track: SpotifyTrack) => void;
  /** Các thao tác riêng của từng tab (bỏ yêu thích, xóa khỏi playlist, xóa lịch sử...). */
  actions?: ReactNode;
};

const iconLink =
  "inline-flex items-center justify-center gap-1 rounded-lg border border-ink-600 px-3 py-2 text-sm hover:border-lime-500";

export function TrackRow({ provider, trackId, meta, subtitle, onPlay, actions }: TrackRowProps) {
  const { currentTrack, paused } = useSpotifyPlayer();
  const isSpotify = provider === "spotify";
  const title = meta.track_name ?? (isSpotify ? "Bài hát Spotify" : "Bài hát");
  const track = isSpotify ? savedToSpotifyTrack({ track_id: trackId, ...meta }) : null;
  const isCurrent = Boolean(track && (currentTrack?.id === trackId || currentTrack?.uri === track.uri));

  return (
    <li
      className={`flex flex-wrap items-center gap-3 rounded-xl border bg-ink-950 p-3 ${
        isCurrent ? "border-lime-500" : "border-ink-700"
      }`}
    >
      {meta.cover_url ? (
        <img src={meta.cover_url} alt={`Ảnh bìa ${title}`} loading="lazy" className="size-14 shrink-0 rounded-lg object-cover" />
      ) : (
        <div className="grid size-14 shrink-0 place-items-center rounded-lg bg-ink-800 text-mist-400">
          <Music2 size={20} aria-hidden />
        </div>
      )}

      <div className="min-w-0 flex-1 basis-40">
        <p className="truncate font-semibold">{title}</p>
        <p className="truncate text-sm text-mist-300">{meta.artist_name ?? "Chưa rõ nghệ sĩ"}</p>
        {subtitle && <p className="truncate text-xs text-mist-400">{subtitle}</p>}
        {isCurrent && (
          <p className="text-xs font-medium text-lime-400">{paused ? "Đang tạm dừng" : "Đang phát"}</p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {track ? (
          <>
            <button
              type="button"
              onClick={() => onPlay(track)}
              aria-label={`Phát ${title}`}
              className="inline-flex items-center gap-2 rounded-lg bg-lime-400 px-3 py-2 text-sm font-semibold text-ink-950 hover:bg-lime-300"
            >
              <PlayCircle size={16} aria-hidden /> Phát
            </button>
            <a
              href={meta.spotify_url ?? spotifyTrackUrl(trackId)}
              target="_blank"
              rel="noreferrer"
              aria-label={`Mở ${title} trên Spotify`}
              className={iconLink}
            >
              Spotify <ExternalLink size={13} aria-hidden />
            </a>
          </>
        ) : (
          <span className="text-xs text-mist-400">Nguồn này chưa hỗ trợ phát</span>
        )}
        {actions}
      </div>
    </li>
  );
}

export const panelClass = "rounded-2xl border border-ink-700 bg-ink-900 p-5 sm:p-6";

export function LoadingBox({ text }: { text: string }) {
  return (
    <p role="status" className="rounded-xl border border-ink-700 p-5 text-sm text-mist-300">
      {text}
    </p>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-red-800/70 bg-red-950/30 p-4 text-sm text-red-200">
      <p>{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="mt-3 rounded-lg border border-red-700 px-3 py-2 font-medium hover:bg-red-900/40">
          Thử lại
        </button>
      )}
    </div>
  );
}

export function EmptyBox({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="rounded-xl border border-dashed border-ink-700 p-8 text-center">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-mist-300">{hint}</p>
    </div>
  );
}
