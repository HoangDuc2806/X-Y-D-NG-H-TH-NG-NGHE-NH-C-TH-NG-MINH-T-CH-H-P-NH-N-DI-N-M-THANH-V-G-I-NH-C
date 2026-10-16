"use client";

import { useCallback, useState } from "react";
import type { SpotifyTrack } from "@/lib/api";
import { useSpotifyPlayer } from "@/components/spotify-player-provider";

/** Phát một bài bằng trình phát Spotify hiện có, cùng cách xử lý lỗi như trang Tìm kiếm. */
export function usePlayTrack() {
  const { authorized, ready, playTrack, connectSpotify } = useSpotifyPlayer();
  const [error, setError] = useState("");

  const play = useCallback(
    async (track: SpotifyTrack) => {
      setError("");
      if (!authorized) {
        connectSpotify(window.location.pathname + window.location.search);
        return;
      }
      if (!ready) {
        setError("Trình phát Spotify đang kết nối. Hãy đợi vài giây rồi thử lại.");
        return;
      }
      try {
        await playTrack(track);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Không thể phát bài hát trên Spotify.");
      }
    },
    [authorized, ready, playTrack, connectSpotify],
  );

  return { play, error, clearError: () => setError(""), authorized, ready };
}
