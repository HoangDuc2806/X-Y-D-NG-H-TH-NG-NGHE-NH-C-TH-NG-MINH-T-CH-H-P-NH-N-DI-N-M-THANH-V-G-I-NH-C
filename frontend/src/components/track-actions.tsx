"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Heart, ListPlus, LoaderCircle } from "lucide-react";
import type { SpotifyTrack } from "@/lib/api";
import { useAuth } from "@/components/providers";
import { addPlaylistTrack, errorMessage, favoriteKey, type PlaylistSummary } from "@/lib/library-api";
import { libraryKeys, useFavorites, usePlaylists, useToggleFavorite } from "@/lib/library-hooks";

type Notice = { kind: "ok" | "error"; text: string };

const iconButton =
  "inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-ink-600 text-mist-300 transition hover:border-lime-500 hover:text-lime-400 disabled:cursor-not-allowed disabled:opacity-50";

function Toast({ notice }: { notice: Notice }) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      role={notice.kind === "error" ? "alert" : "status"}
      className={`fixed bottom-36 left-1/2 z-50 max-w-[90vw] -translate-x-1/2 rounded-xl border px-4 py-2 text-sm shadow-lg md:bottom-24 ${
        notice.kind === "error"
          ? "border-red-800/70 bg-red-950 text-red-200"
          : "border-lime-500/50 bg-ink-800 text-lime-400"
      }`}
    >
      {notice.text}
    </div>,
    document.body,
  );
}

function FavoriteButton({ track, notify }: { track: SpotifyTrack; notify: (notice: Notice) => void }) {
  const router = useRouter();
  const { user } = useAuth();
  const { byKey, query } = useFavorites();
  const toggle = useToggleFavorite();

  const existing = byKey.get(favoriteKey("spotify", track.id));
  const active = Boolean(existing);
  const blocked = Boolean(user) && (query.isLoading || query.isError);
  const label = !user
    ? "Đăng nhập để lưu bài hát yêu thích"
    : query.isError
      ? "Không tải được danh sách yêu thích"
      : active
        ? `Bỏ ${track.name} khỏi yêu thích`
        : `Thêm ${track.name} vào yêu thích`;

  function onClick() {
    if (!user) {
      router.push("/auth/login");
      return;
    }
    toggle.mutate(
      { track, existingId: existing && !existing.id.startsWith("pending-") ? existing.id : null },
      {
        onSuccess: (result) => notify({ kind: "ok", text: result.added ? "Đã thêm vào yêu thích." : "Đã bỏ khỏi yêu thích." }),
        onError: (error) => notify({ kind: "error", text: errorMessage(error, "Không cập nhật được yêu thích.") }),
      },
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={toggle.isPending || blocked}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={`${iconButton} ${active ? "border-lime-500 text-lime-400" : ""}`}
    >
      <Heart size={16} fill={active ? "currentColor" : "none"} aria-hidden />
    </button>
  );
}

const MENU_WIDTH = 256;
const MENU_MAX_HEIGHT = 280;

function AddToPlaylistButton({ track, notify }: { track: SpotifyTrack; notify: (notice: Notice) => void }) {
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ left: number; top?: number; bottom?: number }>({ left: 8 });
  const playlists = usePlaylists(open);

  const add = useMutation({
    mutationFn: (playlist: PlaylistSummary) => addPlaylistTrack(playlist.id, track, playlist.track_count ?? 0),
    onSuccess: (_row, playlist) => {
      void queryClient.invalidateQueries({ queryKey: libraryKeys.playlists(user?.id) });
      void queryClient.invalidateQueries({ queryKey: libraryKeys.playlistTracks(user?.id, playlist.id) });
      notify({ kind: "ok", text: `Đã thêm vào playlist “${playlist.name}”.` });
      setOpen(false);
    },
    onError: (error) => notify({ kind: "error", text: errorMessage(error, "Không thêm được vào playlist.") }),
  });

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  function toggleMenu() {
    if (!user) {
      router.push("/auth/login");
      return;
    }
    if (open) {
      setOpen(false);
      return;
    }
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      const left = Math.max(8, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8));
      const roomBelow = window.innerHeight - rect.bottom;
      setPosition(
        roomBelow >= MENU_MAX_HEIGHT + 96
          ? { left, top: rect.bottom + 8 }
          : { left, bottom: window.innerHeight - rect.top + 8 },
      );
    }
    setOpen(true);
  }

  const label = user ? `Thêm ${track.name} vào playlist` : "Đăng nhập để dùng playlist";

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleMenu}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        className={iconButton}
      >
        <ListPlus size={16} aria-hidden />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label="Chọn playlist"
            style={{ ...position, width: MENU_WIDTH, maxHeight: MENU_MAX_HEIGHT }}
            className="fixed z-50 overflow-y-auto rounded-xl border border-ink-700 bg-ink-900 p-2 shadow-xl"
          >
            {playlists.isLoading && (
              <p className="flex items-center gap-2 p-3 text-sm text-mist-300">
                <LoaderCircle size={14} className="animate-spin" aria-hidden /> Đang tải playlist…
              </p>
            )}
            {playlists.isError && (
              <p role="alert" className="p-3 text-sm text-red-300">
                {errorMessage(playlists.error, "Không tải được playlist.")}
              </p>
            )}
            {playlists.data?.length === 0 && (
              <p className="p-3 text-sm text-mist-300">
                Bạn chưa có playlist.{" "}
                <Link href="/library" className="text-lime-400 underline">
                  Tạo playlist trong Thư viện
                </Link>
              </p>
            )}
            {playlists.data?.map((playlist) => (
              <button
                key={playlist.id}
                type="button"
                role="menuitem"
                disabled={add.isPending}
                onClick={() => add.mutate(playlist)}
                className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-ink-800 disabled:opacity-60"
              >
                <span className="truncate">{playlist.name}</span>
                {add.isPending && add.variables?.id === playlist.id ? (
                  <LoaderCircle size={14} className="shrink-0 animate-spin" aria-hidden />
                ) : (
                  <span className="shrink-0 text-xs text-mist-400">{playlist.track_count ?? 0} bài</span>
                )}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}

/** Nút Yêu thích + Thêm vào playlist cho một thẻ bài hát Spotify. */
export function TrackActions({ track }: { track: SpotifyTrack }) {
  const [notice, setNotice] = useState<Notice | null>(null);
  const timer = useRef<number | null>(null);

  function notify(next: Notice) {
    setNotice(next);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setNotice(null), 4000);
  }

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  return (
    <>
      <FavoriteButton track={track} notify={notify} />
      <AddToPlaylistButton track={track} notify={notify} />
      {notice && <Toast notice={notice} />}
    </>
  );
}

