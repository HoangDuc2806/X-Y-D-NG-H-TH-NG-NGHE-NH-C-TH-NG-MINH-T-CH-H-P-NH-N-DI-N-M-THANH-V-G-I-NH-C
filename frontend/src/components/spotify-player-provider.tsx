
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { SpotifyTrack } from "@/lib/api";
import { hasSession, metaFromSdkTrack, recordHistory } from "@/lib/library-api";
import { emptySession, nextListenStep, spotifyTrackIdFromUri, type ListenSession } from "@/lib/listen-tracker";
import {
  clearSpotifyAuthorization,
  getValidSpotifyAccessToken,
  SPOTIFY_AUTH_CHANGED_EVENT,
  spotifyClientConfigured,
  startSpotifyAuthorizationFromCurrentHost,
} from "@/lib/spotify-oauth";

type CurrentTrack = {
  uri: string;
  id?: string;
  name: string;
  artists: string[];
  albumName: string;
  albumImageUrl: string | null;
  durationMs: number;
};

type SpotifyPlayerContextValue = {
  configured: boolean;
  authorized: boolean;
  ready: boolean;
  currentTrack: CurrentTrack | null;
  paused: boolean;
  position: number;
  duration: number;
  volume: number;
  error: string;
  connectSpotify: (returnTo?: string) => void;
  disconnectSpotify: () => void;
  playTrack: (track: SpotifyTrack) => Promise<void>;
  togglePlayback: () => Promise<void>;
  nextTrack: () => Promise<void>;
  previousTrack: () => Promise<void>;
  seekTo: (positionMs: number) => Promise<void>;
  setVolume: (value: number) => void;
};

const SpotifyPlayerContext =
  createContext<SpotifyPlayerContextValue | null>(null);

function loadSpotifySdk() {
  return new Promise<void>((resolve, reject) => {
    if (window.Spotify?.Player) {
      resolve();
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://sdk.scdn.co/spotify-player.js"]'
    );

    const previousReady = window.onSpotifyWebPlaybackSDKReady;

    window.onSpotifyWebPlaybackSDKReady = () => {
      previousReady?.();
      resolve();
    };

    if (existing) {
      existing.addEventListener(
        "error",
        () =>
          reject(
            new Error("Không tải được Spotify Web Playback SDK.")
          ),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.async = true;

    script.onerror = () =>
      reject(
        new Error(
          "Không tải được Spotify Web Playback SDK. Hãy kiểm tra kết nối hoặc tiện ích chặn quảng cáo."
        )
      );

    document.body.appendChild(script);
  });
}

function currentTrackFromState(
  state: SpotifySdkPlaybackState | null
): CurrentTrack | null {
  const track = state?.track_window?.current_track;

  if (!track) return null;

  return {
    uri: track.uri,
    id: track.id,
    name: track.name,
    artists: track.artists?.map((artist) => artist.name) ?? [],
    albumName: track.album?.name ?? "",
    albumImageUrl: track.album?.images?.[0]?.url ?? null,
    durationMs: track.duration_ms ?? state?.duration ?? 0,
  };
}

export function SpotifyPlayerProvider({
  children,
}: {
  children: ReactNode;
}) {
  const playerRef = useRef<SpotifySdkPlayer | null>(null);
  const deviceIdRef = useRef<string | null>(null);
  const queryClient = useQueryClient();
  const listenSessionRef = useRef<ListenSession>(emptySession());

  const [authChecked, setAuthChecked] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [ready, setReady] = useState(false);
  const [currentTrack, setCurrentTrack] =
    useState<CurrentTrack | null>(null);
  const [paused, setPaused] = useState(true);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.5);
  const [error, setError] = useState("");

  // Ghi lịch sử nghe khi Spotify xác nhận bài hát THỰC SỰ đang phát (xem lib/listen-tracker.ts).
  // Lỗi ghi lịch sử chỉ được log; không bao giờ ảnh hưởng đến trình phát.
  const trackListen = useCallback(
    (state: SpotifySdkPlaybackState | null) => {
      const track = state?.track_window?.current_track;
      const uriId = spotifyTrackIdFromUri(track?.uri);
      const linkedId = track?.linked_from?.id ?? spotifyTrackIdFromUri(track?.linked_from?.uri);
      const key = uriId ? (linkedId ?? uriId) : null; // chỉ bài hát (không phải podcast/local)

      const step = nextListenStep(listenSessionRef.current, {
        key,
        paused: state?.paused ?? true,
        loading: Boolean(state?.loading),
        position: state?.position ?? 0,
      });
      listenSessionRef.current = step.session;
      if (!step.shouldRecord || !key || !track) return;

      void (async () => {
        try {
          if (!(await hasSession())) return; // chưa đăng nhập: không có gì để ghi
          await recordHistory({ provider: "spotify", track_id: key, ...metaFromSdkTrack(track, key) });
          void queryClient.invalidateQueries({ queryKey: ["history"] });
        } catch (caught) {
          console.warn("Không ghi được lịch sử nghe:", caught instanceof Error ? caught.message : caught);
        }
      })();
    },
    [queryClient],
  );
  const trackListenRef = useRef(trackListen);
  trackListenRef.current = trackListen;

  const syncAuthorization = useCallback(async () => {
    try {
      const token = await getValidSpotifyAccessToken();

      setAuthorized(Boolean(token));

      if (!token) {
        setReady(false);
        deviceIdRef.current = null;
      }
    } catch {
      setAuthorized(false);
      setError(
        "Không kiểm tra được phiên Spotify. Hãy kết nối lại."
      );
    } finally {
      setAuthChecked(true);
    }
  }, []);

  useEffect(() => {
    void syncAuthorization();

    const onAuthChanged = () => {
      void syncAuthorization();
    };

    window.addEventListener(
      SPOTIFY_AUTH_CHANGED_EVENT,
      onAuthChanged
    );

    return () => {
      window.removeEventListener(
        SPOTIFY_AUTH_CHANGED_EVENT,
        onAuthChanged
      );
    };
  }, [syncAuthorization]);

  useEffect(() => {
    if (!authChecked || !authorized) return;

    let disposed = false;
    let player: SpotifySdkPlayer | null = null;

    const initialize = async () => {
      try {
        await loadSpotifySdk();

        if (disposed || !window.Spotify?.Player) return;

        player = new window.Spotify.Player({
          name: "Music Discovery Vietnam",
          volume,
          enableMediaSession: true,

          getOAuthToken: (callback) => {
            void getValidSpotifyAccessToken()
              .then((token) => {
                if (token) {
                  callback(token);
                } else {
                  setAuthorized(false);
                  setError(
                    "Phiên Spotify đã hết hạn. Hãy kết nối lại tài khoản."
                  );
                }
              })
              .catch(() =>
                setError("Không làm mới được phiên Spotify.")
              );
          },
        });

        playerRef.current = player;

        player.addListener(
          "ready",
          ({ device_id }: { device_id: string }) => {
            if (disposed) return;

            deviceIdRef.current = device_id;
            setReady(true);
            setError("");

            void player?.getCurrentState().then((state) => {
              if (!disposed && state) {
                setCurrentTrack(currentTrackFromState(state));
                setPaused(state.paused);
                setPosition(state.position);
                setDuration(state.duration);
              }
            });
          }
        );

        player.addListener("not_ready", () => {
          if (disposed) return;

          deviceIdRef.current = null;
          setReady(false);
        });

        player.addListener(
          "player_state_changed",
          (state: SpotifySdkPlaybackState | null) => {
            if (disposed) return;

            setCurrentTrack(currentTrackFromState(state));
            setPaused(state?.paused ?? true);
            setPosition(state?.position ?? 0);
            setDuration(state?.duration ?? 0);
            trackListenRef.current(state);
          }
        );

        player.addListener(
          "initialization_error",
          ({ message }: { message: string }) => {
            if (!disposed) {
              setError(
                `Spotify Player không khởi tạo được: ${message}`
              );
            }
          }
        );

        player.addListener(
          "authentication_error",
          ({ message }: { message: string }) => {
            if (!disposed) {
              setError(
                `Spotify xác thực không thành công: ${message}`
              );
            }
          }
        );

        player.addListener("account_error", () => {
          if (!disposed) {
            setError(
              "Web Playback SDK cần tài khoản Spotify Premium. Hãy kiểm tra tài khoản đã kết nối."
            );
          }
        });

        player.addListener(
          "playback_error",
          ({ message }: { message: string }) => {
            if (!disposed) {
              setError(
                `Spotify không phát được bài này: ${message}`
              );
            }
          }
        );

        const connected = await player.connect();

        if (!connected && !disposed) {
          setError(
            "Chưa kết nối được trình phát Spotify. Hãy tải lại trang hoặc kết nối lại."
          );
        }
      } catch (caught) {
        if (!disposed) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Không khởi tạo được Spotify Player."
          );
        }
      }
    };

    void initialize();

    return () => {
      disposed = true;
      player?.disconnect();

      if (playerRef.current === player) {
        playerRef.current = null;
      }

      deviceIdRef.current = null;
      listenSessionRef.current = emptySession();
      setReady(false);
    };

    // Player instance is intentionally recreated only when authorization changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecked, authorized]);

  // Đồng bộ thời gian phát vì player_state_changed không liên tục
  // gửi các cập nhật vị trí phát.
  useEffect(() => {
    if (!ready || paused) return;

    const player = playerRef.current;

    if (!player) return;

    let disposed = false;
    let requestInProgress = false;

    const refreshPosition = async () => {
      if (disposed || requestInProgress) return;

      requestInProgress = true;

      try {
        const state = await player.getCurrentState();

        if (disposed || !state) return;

        setPosition(state.position);
        setDuration(state.duration);
        setPaused(state.paused);
      } catch {
        // Bỏ qua lỗi đọc trạng thái tạm thời.
      } finally {
        requestInProgress = false;
      }
    };

    void refreshPosition();

    const timer = window.setInterval(() => {
      void refreshPosition();
    }, 500);

    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [ready, paused]);

  const connectSpotify = useCallback((returnTo = "/search") => {
    setError("");
    startSpotifyAuthorizationFromCurrentHost(returnTo);
  }, []);

  const disconnectSpotify = useCallback(() => {
    playerRef.current?.disconnect();
    playerRef.current = null;
    deviceIdRef.current = null;

    clearSpotifyAuthorization();
    listenSessionRef.current = emptySession();

    setAuthorized(false);
    setReady(false);
    setCurrentTrack(null);
    setPaused(true);
    setPosition(0);
    setDuration(0);
    setError("");
  }, []);

  const playTrack = useCallback(
    async (track: SpotifyTrack) => {
      if (!authorized) {
        throw new Error(
          "Hãy bấm Kết nối Spotify trước khi phát nhạc."
        );
      }

      const player = playerRef.current;
      const deviceId = deviceIdRef.current;

      if (!player || !deviceId || !ready) {
        throw new Error(
          "Trình phát Spotify đang khởi tạo. Đợi vài giây rồi thử lại."
        );
      }

      const token = await getValidSpotifyAccessToken();

      if (!token) {
        setAuthorized(false);
        throw new Error(
          "Phiên Spotify đã hết hạn. Hãy kết nối lại."
        );
      }

      setError("");

      await player.activateElement();

      const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };

      const transferResponse = await fetch(
        "https://api.spotify.com/v1/me/player",
        {
          method: "PUT",
          headers,
          body: JSON.stringify({
            device_ids: [deviceId],
            play: false,
          }),
          cache: "no-store",
        }
      );

      if (
        !transferResponse.ok &&
        transferResponse.status !== 204
      ) {
        throw new Error(
          transferResponse.status === 403
            ? "Spotify từ chối quyền điều khiển phát nhạc. Hãy kiểm tra quyền tài khoản và Developer Dashboard."
            : "Không chuyển được phát nhạc sang trình phát của website."
        );
      }

      const playResponse = await fetch(
        `https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(deviceId)}`,
        {
          method: "PUT",
          headers,
          body: JSON.stringify({
            uris: [track.uri],
          }),
          cache: "no-store",
        }
      );

      if (!playResponse.ok && playResponse.status !== 204) {
        if (playResponse.status === 401) {
          throw new Error(
            "Phiên Spotify đã hết hạn. Hãy kết nối lại tài khoản."
          );
        }

        if (playResponse.status === 403) {
          throw new Error(
            "Spotify không cho phép phát bài này hoặc thiếu quyền điều khiển phát nhạc."
          );
        }

        if (playResponse.status === 404) {
          throw new Error(
            "Spotify chưa nhận thiết bị phát. Hãy đợi vài giây rồi thử lại."
          );
        }

        throw new Error(
          "Spotify không thể phát bài hát này lúc này."
        );
      }

      setCurrentTrack({
        uri: track.uri,
        id: track.id,
        name: track.name,
        artists: track.artists,
        albumName: track.album_name ?? "",
        albumImageUrl: track.album_image_url,
        durationMs: track.duration_ms,
      });

      setPaused(false);
    },
    [authorized, ready]
  );

  const togglePlayback = useCallback(async () => {
    if (!playerRef.current || !currentTrack) return;

    await playerRef.current.activateElement();
    await playerRef.current.togglePlay();
  }, [currentTrack]);

  const nextTrack = useCallback(async () => {
    await playerRef.current?.nextTrack();
  }, []);

  const previousTrack = useCallback(async () => {
    await playerRef.current?.previousTrack();
  }, []);

  // Tua đến vị trí tính bằng mili giây.
  const seekTo = useCallback(
    async (positionMs: number) => {
      const player = playerRef.current;

      if (!player || !ready || !currentTrack) {
        throw new Error(
          "Trình phát Spotify chưa sẵn sàng để tua."
        );
      }

      const maxPosition = Math.max(
        0,
        duration || currentTrack.durationMs
      );

      const targetPosition = Math.max(
        0,
        Math.min(Math.floor(positionMs), maxPosition)
      );

      try {
        await player.seek(targetPosition);

        setPosition(targetPosition);
        setError("");
      } catch {
        setError(
          "Không tua được bài hát Spotify. Hãy thử lại."
        );

        throw new Error(
          "Không tua được bài hát Spotify."
        );
      }
    },
    [currentTrack, duration, ready]
  );

  const setVolume = useCallback((value: number) => {
    const safeValue = Math.min(1, Math.max(0, value));

    setVolumeState(safeValue);

    void playerRef.current
      ?.setVolume(safeValue)
      .catch(() =>
        setError("Không điều chỉnh được âm lượng Spotify.")
      );
  }, []);

  const value = useMemo<SpotifyPlayerContextValue>(
    () => ({
      configured: spotifyClientConfigured(),
      authorized,
      ready,
      currentTrack,
      paused,
      position,
      duration,
      volume,
      error,
      connectSpotify,
      disconnectSpotify,
      playTrack,
      togglePlayback,
      nextTrack,
      previousTrack,
      seekTo,
      setVolume,
    }),
    [
      authorized,
      ready,
      currentTrack,
      paused,
      position,
      duration,
      volume,
      error,
      connectSpotify,
      disconnectSpotify,
      playTrack,
      togglePlayback,
      nextTrack,
      previousTrack,
      seekTo,
      setVolume,
    ]
  );

  return (
    <SpotifyPlayerContext.Provider value={value}>
      {children}
    </SpotifyPlayerContext.Provider>
  );
}

export function useSpotifyPlayer() {
  const context = useContext(SpotifyPlayerContext);

  if (!context) {
    throw new Error(
      "useSpotifyPlayer phải được sử dụng trong SpotifyPlayerProvider."
    );
  }

  return context;
}
