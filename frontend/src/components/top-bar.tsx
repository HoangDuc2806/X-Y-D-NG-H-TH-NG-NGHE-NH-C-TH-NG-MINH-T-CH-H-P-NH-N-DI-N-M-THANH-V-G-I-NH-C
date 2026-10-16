"use client";

import { Music2, Search, Unplug } from "lucide-react";
import { UserMenu } from "@/components/user-menu";
import { useSpotifyPlayer } from "@/components/spotify-player-provider";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function TopBar() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const { configured: spotifyConfigured, authorized: spotifyAuthorized, ready: spotifyReady, connectSpotify, disconnectSpotify } = useSpotifyPlayer();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const term = q.trim();
    if (term) router.push(`/search?q=${encodeURIComponent(term)}`);
  }

  return (
    <header className="sticky top-0 z-10 border-b border-ink-700 bg-ink-950/90 px-4 py-3 backdrop-blur md:px-8">
      <div className="flex items-center gap-3"><form onSubmit={onSubmit} role="search" className="relative min-w-0 flex-1 max-w-xl">
        <label htmlFor="global-search" className="sr-only">
          Tìm bài hát, nghệ sĩ hoặc album
        </label>
        <Search size={16} aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-mist-300" />
        <input
          id="global-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm bài hát, nghệ sĩ hoặc album"
          className="w-full rounded-full border border-ink-700 bg-ink-800 py-2 pl-9 pr-4 text-sm placeholder:text-mist-300 focus:border-lime-500"
        />
      </form><div className="flex items-center gap-2">{spotifyAuthorized ? <button type="button" onClick={disconnectSpotify} title="Ngắt kết nối Spotify" className="inline-flex items-center gap-1.5 rounded-full border border-lime-700/60 bg-lime-400/10 px-3 py-2 text-xs text-lime-300 hover:bg-lime-400/20"><Music2 size={14}/><span className="hidden sm:inline">{spotifyReady ? "Spotify đã kết nối" : "Đang kết nối Spotify…"}</span><Unplug size={13}/></button> : <button type="button" disabled={!spotifyConfigured} onClick={() => connectSpotify(window.location.pathname + window.location.search)} title={spotifyConfigured ? "Kết nối tài khoản Spotify Premium" : "Cần cấu hình NEXT_PUBLIC_SPOTIFY_CLIENT_ID"} className="inline-flex items-center gap-1.5 rounded-full bg-lime-400 px-3 py-2 text-xs font-semibold text-ink-950 hover:bg-lime-300 disabled:cursor-not-allowed disabled:opacity-50"><Music2 size={14}/><span className="hidden sm:inline">Kết nối Spotify</span></button>}<UserMenu /></div></div>
    </header>
  );
}
