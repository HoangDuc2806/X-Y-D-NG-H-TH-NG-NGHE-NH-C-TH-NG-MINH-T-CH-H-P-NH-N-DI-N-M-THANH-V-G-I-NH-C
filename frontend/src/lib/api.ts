export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type HealthResponse = { status: string; service: string };

export class ApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

export async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { signal });
  } catch {
    throw new ApiError("Không kết nối được tới máy chủ.");
  }
  if (!res.ok) throw new ApiError("Máy chủ trả về lỗi.", res.status);
  return (await res.json()) as T;
}

export const getHealth = (signal?: AbortSignal) => apiGet<HealthResponse>("/api/health", signal);


export type RecognizedTrack = {
  title: string;
  artists: string[];
  album: string | null;
  year: number | null;
  score: number;
  acoustid_id: string | null;
  musicbrainz_recording_id: string | null;
  musicbrainz_url: string | null;
  acoustid_url: string | null;
};

export type MusicRecognitionResponse = {
  status: "matched" | "not_found";
  message: string;
  duration_seconds: number;
  results: RecognizedTrack[];
};

export async function identifyAudio(file: File, accessToken: string, signal?: AbortSignal): Promise<MusicRecognitionResponse> {
  const form = new FormData();
  form.append("file", file, file.name);

  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/identify`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
      signal,
      cache: "no-store",
    });
  } catch {
    throw new ApiError("Không kết nối được tới máy chủ nhận diện.");
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: { message?: string }; detail?: string } | null;
    const message = body?.error?.message ?? body?.detail ?? "Không thể nhận diện âm thanh.";
    throw new ApiError(message, response.status);
  }
  return (await response.json()) as MusicRecognitionResponse;
}


export type SpotifyTrack = {
  id: string;
  name: string;
  artists: string[];
  album_name: string | null;
  album_image_url: string | null;
  release_date: string | null;
  duration_ms: number;
  spotify_url: string;
  uri: string;
};

export type SpotifySearchResponse = {
  provider: "spotify";
  query: string;
  market: string;
  items: SpotifyTrack[];
};

export async function searchSpotifyTracks(query: string, signal?: AbortSignal): Promise<SpotifySearchResponse> {
  const params = new URLSearchParams({ q: query, limit: "10", market: "VN" });
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/spotify/search?${params.toString()}`, {
      signal,
      cache: "no-store",
    });
  } catch {
    throw new ApiError("Không kết nối được máy chủ tìm kiếm Spotify.");
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: { message?: string }; detail?: string } | null;
    throw new ApiError(body?.error?.message ?? body?.detail ?? "Không tìm kiếm được trên Spotify.", response.status);
  }
  return (await response.json()) as SpotifySearchResponse;
}
