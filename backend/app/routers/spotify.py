"""Public Spotify catalog search endpoint; no user-specific data is requested."""
from typing import Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict

from app.core.config import Settings, get_settings
from app.services.spotify_catalog import search_spotify_tracks

router = APIRouter(prefix="/api/spotify", tags=["Spotify"])


class SpotifyTrack(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    artists: list[str]
    album_name: str | None = None
    album_image_url: str | None = None
    release_date: str | None = None
    duration_ms: int
    spotify_url: str
    uri: str


class SpotifySearchResponse(BaseModel):
    provider: Literal["spotify"] = "spotify"
    query: str
    market: str
    items: list[SpotifyTrack]


@router.get("/search", response_model=SpotifySearchResponse, summary="Search Spotify tracks")
async def search_tracks(
    q: str = Query(min_length=1, max_length=200, description="Tên bài hát, nghệ sĩ hoặc album"),
    limit: int = Query(default=10, ge=1, le=10),
    market: str = Query(default="VN", min_length=2, max_length=2, pattern="^[A-Z]{2}$"),
    settings: Settings = Depends(get_settings),
) -> SpotifySearchResponse:
    query = q.strip()
    if not query:
        from fastapi import HTTPException
        raise HTTPException(status_code=422, detail="Hãy nhập tên bài hát hoặc nghệ sĩ.")
    items = await search_spotify_tracks(query, limit, market, settings)
    return SpotifySearchResponse(query=query, market=market, items=items)
