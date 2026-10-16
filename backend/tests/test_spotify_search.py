from fastapi.testclient import TestClient

from app.core.config import Settings, get_settings
from app.main import create_app


def make_app(settings: Settings | None = None):
    app = create_app()
    app.dependency_overrides[get_settings] = lambda: settings or Settings(
        spotify_client_id="test-client-id",
        spotify_client_secret="test-client-secret",
    )
    return app


def test_spotify_search_returns_catalog_tracks(monkeypatch):
    from app.routers import spotify

    async def fake_search(query, limit, market, settings):
        assert query == "B-Ray"
        assert limit == 5
        assert market == "VN"
        assert settings.spotify_client_id == "test-client-id"
        return [{
            "id": "spotify-track-id",
            "name": "Song name",
            "artists": ["Artist name"],
            "album_name": "Album name",
            "album_image_url": "https://i.scdn.co/image/example",
            "release_date": "2024-01-01",
            "duration_ms": 190000,
            "spotify_url": "https://open.spotify.com/track/spotify-track-id",
            "uri": "spotify:track:spotify-track-id",
        }]

    monkeypatch.setattr(spotify, "search_spotify_tracks", fake_search)
    response = TestClient(make_app()).get(
        "/api/spotify/search", params={"q": "B-Ray", "limit": 5, "market": "VN"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["provider"] == "spotify"
    assert body["items"][0]["id"] == "spotify-track-id"
    assert body["items"][0]["artists"] == ["Artist name"]


def test_spotify_search_rejects_blank_query():
    response = TestClient(make_app()).get("/api/spotify/search", params={"q": "   "})
    assert response.status_code == 422


def test_spotify_search_requires_credentials(monkeypatch):
    from app.routers import spotify

    async def should_not_search(query, limit, market, settings):
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail="Backend chưa cấu hình Spotify.")

    monkeypatch.setattr(spotify, "search_spotify_tracks", should_not_search)
    settings = Settings(spotify_client_id="", spotify_client_secret="")
    response = TestClient(make_app(settings)).get("/api/spotify/search", params={"q": "B-Ray"})
    assert response.status_code == 503
