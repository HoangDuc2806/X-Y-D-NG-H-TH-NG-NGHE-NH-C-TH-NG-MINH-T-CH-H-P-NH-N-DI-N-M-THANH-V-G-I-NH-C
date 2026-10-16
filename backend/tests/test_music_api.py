from datetime import datetime, timezone
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

from app.core.auth import AuthContext, AuthenticatedUser, get_auth_context
from app.core.config import Settings, get_settings
from app.core.supabase import SupabaseRestClient, get_user_supabase
from app.main import create_app

USER_ID = UUID("c924b932-e8d5-4fb2-9f43-0ed81066cc29")
OTHER_ID = UUID("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")
PLAYLIST_ID = UUID("11111111-1111-4111-8111-111111111111")
ROW_ID = UUID("22222222-2222-4222-8222-222222222222")
NOW = datetime(2026, 10, 16, 0, 0, tzinfo=timezone.utc)


class FakeSupabase:
    def __init__(self, calls, responses=None):
        self.calls = calls
        self.responses = responses or {}

    async def select(self, table, *, select, filters=None, order=None, limit=None):
        self.calls.append(("select", table, select, filters, order, limit))
        return self.responses.get(("select", table), [])

    async def insert(self, table, payload, *, select, prefer="return=representation", params=None):
        self.calls.append(("insert", table, payload, select, prefer, params))
        return self.responses.get(("insert", table), [])

    async def update(self, table, payload, *, filters, select):
        self.calls.append(("update", table, payload, filters, select))
        return self.responses.get(("update", table), [])

    async def delete(self, table, *, filters, select="id"):
        self.calls.append(("delete", table, filters, select))
        return self.responses.get(("delete", table), [])


def make_app(fake):
    app = create_app()
    app.dependency_overrides[get_auth_context] = lambda: AuthContext(
        user=AuthenticatedUser(id=USER_ID, email="member@example.com"),
        access_token="user-access-token",
    )
    app.dependency_overrides[get_user_supabase] = lambda: fake
    app.dependency_overrides[get_settings] = lambda: Settings(
        supabase_url="https://example.supabase.co",
        supabase_publishable_key="publishable-key",
    )
    return app


def test_music_endpoints_require_auth():
    client = TestClient(create_app())
    paths = [
        "/api/profile",
        "/api/favorites",
        "/api/playlists",
        f"/api/playlists/{PLAYLIST_ID}/tracks",
        f"/api/playlists/{PLAYLIST_ID}/items",
        "/api/listening-history",
    ]
    for path in paths:
        assert client.get(path).status_code == 401


def test_profile_get_is_scoped_to_current_user():
    calls = []
    fake = FakeSupabase(calls, {
        ("select", "profiles"): [{
            "id": str(USER_ID),
            "display_name": "duc",
            "created_at": NOW.isoformat(),
            "updated_at": NOW.isoformat(),
        }]
    })
    client = TestClient(make_app(fake))
    response = client.get("/api/profile")
    assert response.status_code == 200
    assert response.json()["id"] == str(USER_ID)
    assert calls[0][3] == {"id": f"eq.{USER_ID}"}


def test_profile_update_rejects_user_id_from_client():
    fake = FakeSupabase([])
    client = TestClient(make_app(fake))
    response = client.patch(
        "/api/profile",
        json={"display_name": "new name", "id": str(OTHER_ID)},
    )
    assert response.status_code == 422
    assert fake.calls == []


def test_favorite_create_uses_authenticated_user_id():
    calls = []
    fake = FakeSupabase(calls, {
        ("insert", "favorites"): [{
            "id": str(ROW_ID),
            "user_id": str(USER_ID),
            "provider": "licensed",
            "track_id": "track-1",
            "created_at": NOW.isoformat(),
        }]
    })
    client = TestClient(make_app(fake))
    response = client.post("/api/favorites", json={
        "provider": "licensed",
        "track_id": "track-1",
    })
    assert response.status_code == 201
    assert response.json()["user_id"] == str(USER_ID)
    insert = calls[0]
    assert insert[2]["user_id"] == str(USER_ID)
    assert "id" not in insert[2]
    assert insert[4] == "resolution=ignore-duplicates,return=representation"
    assert insert[5] == {"on_conflict": "user_id,provider,track_id"}


def test_duplicate_favorite_returns_existing_row_without_update_policy():
    calls = []
    existing = {
        "id": str(ROW_ID),
        "user_id": str(USER_ID),
        "provider": "spotify",
        "track_id": "track-duplicate",
        "created_at": NOW.isoformat(),
    }
    fake = FakeSupabase(calls, {
        ("insert", "favorites"): [],
        ("select", "favorites"): [existing],
    })
    client = TestClient(make_app(fake))
    response = client.post("/api/favorites", json={"provider": "spotify", "track_id": "track-duplicate"})
    assert response.status_code == 201
    assert response.json()["id"] == str(ROW_ID)
    assert [call[0] for call in calls] == ["insert", "select"]
    assert calls[1][3] == {
        "user_id": f"eq.{USER_ID}",
        "provider": "eq.spotify",
        "track_id": "eq.track-duplicate",
    }


def test_playlist_create_never_accepts_client_user_id():
    calls = []
    fake = FakeSupabase(calls, {
        ("insert", "playlists"): [{
            "id": str(PLAYLIST_ID),
            "user_id": str(USER_ID),
            "name": "Học bài",
            "description": "",
            "created_at": NOW.isoformat(),
            "updated_at": NOW.isoformat(),
        }]
    })
    client = TestClient(make_app(fake))
    response = client.post("/api/playlists", json={
        "name": "Học bài",
        "description": "",
        "user_id": str(OTHER_ID),
    })
    assert response.status_code == 422
    assert calls == []


def test_playlist_create_injects_current_user_id():
    calls = []
    fake = FakeSupabase(calls, {
        ("insert", "playlists"): [{
            "id": str(PLAYLIST_ID),
            "user_id": str(USER_ID),
            "name": "Học bài",
            "description": "",
            "created_at": NOW.isoformat(),
            "updated_at": NOW.isoformat(),
        }]
    })
    client = TestClient(make_app(fake))
    response = client.post("/api/playlists", json={"name": " Học bài "})
    assert response.status_code == 201
    assert calls[0][2]["user_id"] == str(USER_ID)
    assert calls[0][2]["name"] == "Học bài"


def test_playlist_track_create_uses_path_playlist_and_no_user_id():
    calls = []
    fake = FakeSupabase(calls, {
        ("insert", "playlist_tracks"): [{
            "id": str(ROW_ID),
            "playlist_id": str(PLAYLIST_ID),
            "track_id": "licensed-1",
            "track_name": "Bài 1",
            "artist_name": "Ca sĩ",
            "album_name": None,
            "cover_url": None,
            "spotify_url": None,
            "position": 0,
            "created_at": NOW.isoformat(),
        }]
    })
    client = TestClient(make_app(fake))
    response = client.post(
        f"/api/playlists/{PLAYLIST_ID}/tracks",
        json={"track_id": "licensed-1", "track_name": "Bài 1", "position": 0},
    )
    assert response.status_code == 201
    payload = calls[0][2]
    assert payload["playlist_id"] == str(PLAYLIST_ID)
    assert "user_id" not in payload


def test_playlist_item_create_injects_current_user_id():
    calls = []
    fake = FakeSupabase(calls, {
        ("insert", "playlist_items"): [{
            "id": str(ROW_ID),
            "playlist_id": str(PLAYLIST_ID),
            "user_id": str(USER_ID),
            "provider": "licensed",
            "track_id": "licensed-1",
            "position": 0,
            "added_at": NOW.isoformat(),
        }]
    })
    client = TestClient(make_app(fake))
    response = client.post(
        f"/api/playlists/{PLAYLIST_ID}/items",
        json={"provider": "licensed", "track_id": "licensed-1"},
    )
    assert response.status_code == 201
    assert calls[0][2]["user_id"] == str(USER_ID)


def test_history_create_injects_current_user_id():
    calls = []
    fake = FakeSupabase(calls, {
        ("insert", "listening_history"): [{
            "id": str(ROW_ID),
            "user_id": str(USER_ID),
            "provider": "licensed",
            "track_id": "licensed-1",
            "listened_seconds": 31,
            "played_at": NOW.isoformat(),
        }]
    })
    client = TestClient(make_app(fake))
    response = client.post(
        "/api/listening-history",
        json={"provider": "licensed", "track_id": "licensed-1", "listened_seconds": 31},
    )
    assert response.status_code == 201
    assert calls[0][2]["user_id"] == str(USER_ID)


def test_delete_returns_404_when_rls_hides_row():
    fake = FakeSupabase([], {("delete", "favorites"): []})
    client = TestClient(make_app(fake))
    response = client.delete(f"/api/favorites/{ROW_ID}")
    assert response.status_code == 404


def test_upstream_forbidden_is_not_silently_treated_as_success(monkeypatch):
    from app.core import supabase

    async def fake_request(*args, **kwargs):
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Bạn không có quyền truy cập dữ liệu này.")

    monkeypatch.setattr(supabase.SupabaseRestClient, "request", fake_request)
    settings = Settings(
        supabase_url="https://example.supabase.co",
        supabase_publishable_key="publishable-key",
    )
    client = SupabaseRestClient(settings, "user-access-token")
    with pytest.raises(Exception) as exc:
        import asyncio
        asyncio.run(client.select("favorites", select="id"))
    assert getattr(exc.value, "status_code", None) == 403


def test_rest_client_forwards_publishable_key_and_user_token(monkeypatch):
    from app.core import supabase

    seen = {}

    class FakeResponse:
        status_code = 200
        content = b"[]"

        def json(self):
            return []

    class FakeHttpClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        async def request(self, method, url, **kwargs):
            seen.update(method=method, url=url, headers=kwargs["headers"])
            return FakeResponse()

    monkeypatch.setattr(supabase.httpx, "AsyncClient", lambda **kwargs: FakeHttpClient())
    settings = Settings(
        supabase_url="https://example.supabase.co",
        supabase_publishable_key="publishable-key",
    )
    client = SupabaseRestClient(settings, "user-access-token")
    import asyncio
    asyncio.run(client.select("favorites", select="id"))
    assert seen["headers"]["apikey"] == "publishable-key"
    assert seen["headers"]["Authorization"] == "Bearer user-access-token"
    assert "service_role" not in str(seen["headers"]).lower()
