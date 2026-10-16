"""Server-side Spotify catalog search using Client Credentials OAuth."""
from __future__ import annotations

import time
from typing import Any

import httpx
from fastapi import HTTPException

from app.core.config import Settings

_TOKEN: str | None = None
_TOKEN_EXPIRES_AT = 0.0


async def _get_access_token(client: httpx.AsyncClient, settings: Settings) -> str:
    global _TOKEN, _TOKEN_EXPIRES_AT
    if not settings.spotify_client_id.strip() or not settings.spotify_client_secret.strip():
        raise HTTPException(
            status_code=503,
            detail="Backend chưa cấu hình Spotify. Hãy thêm SPOTIFY_CLIENT_ID và SPOTIFY_CLIENT_SECRET vào backend/.env.local.",
        )

    now = time.monotonic()
    if _TOKEN and now < _TOKEN_EXPIRES_AT - 30:
        return _TOKEN

    try:
        response = await client.post(
            "https://accounts.spotify.com/api/token",
            auth=(settings.spotify_client_id.strip(), settings.spotify_client_secret.strip()),
            data={"grant_type": "client_credentials"},
        )
    except (httpx.TimeoutException, httpx.RequestError) as exc:
        raise HTTPException(status_code=503, detail="Không kết nối được dịch vụ xác thực Spotify.") from exc

    if response.status_code != 200:
        # Do not return provider response details or credentials to the client.
        raise HTTPException(
            status_code=503,
            detail="Spotify không cấp access token. Hãy kiểm tra Client ID và Client Secret trong backend/.env.local.",
        )
    try:
        payload = response.json()
        token = payload["access_token"]
        expires_in = int(payload.get("expires_in", 3600))
    except (ValueError, TypeError, KeyError):
        raise HTTPException(status_code=503, detail="Phản hồi xác thực Spotify không hợp lệ.")
    if not isinstance(token, str) or not token:
        raise HTTPException(status_code=503, detail="Spotify không trả về access token hợp lệ.")

    _TOKEN = token
    _TOKEN_EXPIRES_AT = time.monotonic() + max(60, expires_in)
    return token


def _normalise_track(item: dict[str, Any]) -> dict[str, Any] | None:
    track_id = item.get("id")
    if not isinstance(track_id, str) or not track_id:
        return None
    album = item.get("album") or {}
    images = album.get("images") or []
    image_url = next((image.get("url") for image in images if isinstance(image, dict) and image.get("url")), None)
    external_urls = item.get("external_urls") or {}
    artists = [artist.get("name") for artist in item.get("artists", []) if isinstance(artist, dict) and artist.get("name")]
    return {
        "id": track_id,
        "name": str(item.get("name") or "Không rõ tên bài hát"),
        "artists": artists,
        "album_name": album.get("name") if isinstance(album.get("name"), str) else None,
        "album_image_url": image_url,
        "release_date": album.get("release_date") if isinstance(album.get("release_date"), str) else None,
        "duration_ms": item.get("duration_ms") if isinstance(item.get("duration_ms"), int) else 0,
        "spotify_url": external_urls.get("spotify") if isinstance(external_urls.get("spotify"), str) else f"https://open.spotify.com/track/{track_id}",
        "uri": item.get("uri") if isinstance(item.get("uri"), str) else f"spotify:track:{track_id}",
    }


async def search_spotify_tracks(query: str, limit: int, market: str, settings: Settings) -> list[dict[str, Any]]:
    """Search Spotify's public catalog. Credentials remain on the backend."""
    query = query.strip()
    if not query:
        return []
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            token = await _get_access_token(client, settings)
            response = await client.get(
                "https://api.spotify.com/v1/search",
                headers={"Authorization": f"Bearer {token}"},
                params={"q": query, "type": "track", "limit": limit, "market": market},
            )
    except HTTPException:
        raise
    except (httpx.TimeoutException, httpx.RequestError) as exc:
        raise HTTPException(status_code=503, detail="Không kết nối được Spotify. Hãy thử lại sau.") from exc

    if response.status_code == 401:
        # A cached token can be invalidated/replaced on the next request.
        global _TOKEN, _TOKEN_EXPIRES_AT
        _TOKEN, _TOKEN_EXPIRES_AT = None, 0.0
        raise HTTPException(status_code=503, detail="Phiên kết nối Spotify đã hết hạn. Hãy thử lại.")
    if response.status_code == 429:
        raise HTTPException(status_code=503, detail="Spotify đang giới hạn số yêu cầu. Vui lòng thử lại sau.")
    if response.status_code != 200:
        raise HTTPException(status_code=503, detail="Spotify chưa thể trả kết quả tìm kiếm lúc này.")
    try:
        items = response.json().get("tracks", {}).get("items", [])
    except (ValueError, TypeError, AttributeError):
        raise HTTPException(status_code=503, detail="Dữ liệu tìm kiếm từ Spotify không hợp lệ.")
    return [track for item in items if isinstance(item, dict) if (track := _normalise_track(item)) is not None]
