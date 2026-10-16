"""Test Thư viện: yêu thích, lịch sử nghe, playlist, phân quyền giữa hai người dùng.

Lưu ý: các test này kiểm tra logic backend (lọc theo user, chống trùng, mã trạng thái) bằng
DB giả lập trong bộ nhớ. Chúng KHÔNG chứng minh RLS của Supabase thật; RLS cần kiểm tra
riêng trên dự án Supabase (xem README/báo cáo).
"""
from datetime import datetime, timedelta, timezone
from itertools import count
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

from app.core.auth import AuthContext, AuthenticatedUser, get_auth_context
from app.core.config import Settings, get_settings
from app.core.supabase import get_user_supabase
from app.main import create_app

USER_A = UUID("c924b932-e8d5-4fb2-9f43-0ed81066cc29")
USER_B = UUID("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")


class InMemorySupabase:
    """Mô phỏng PostgREST vừa đủ: lọc eq., limit/offset, insert (ignore-duplicates), delete."""

    UNIQUE = {
        "favorites": ("user_id", "provider", "track_id"),
    }

    def __init__(self, store=None):
        self.store = store if store is not None else {}
        self.calls = []
        self._seq = count(1)

    def _rows(self, table):
        return self.store.setdefault(table, [])

    @staticmethod
    def _match(row, filters):
        for key, expr in (filters or {}).items():
            assert expr.startswith("eq."), expr
            if str(row.get(key)) != expr[3:]:
                return False
        return True

    async def select(self, table, *, select, filters=None, order=None, limit=None, offset=None):
        self.calls.append(("select", table, filters))
        rows = [dict(r) for r in self._rows(table) if self._match(r, filters)]
        if table == "playlists":
            for r in rows:
                n = sum(1 for t in self._rows("playlist_tracks") if t["playlist_id"] == r["id"])
                r["playlist_tracks"] = [{"count": n}]
        rows = rows[offset or 0:]
        return rows[:limit] if limit is not None else rows

    async def insert(self, table, payload, *, select, prefer="return=representation", params=None):
        self.calls.append(("insert", table, payload))
        uniq = self.UNIQUE.get(table)
        if uniq and any(all(r.get(k) == payload.get(k) for k in uniq) for r in self._rows(table)):
            return []  # ignore-duplicates
        now = datetime.now(timezone.utc).isoformat()
        row = {"id": str(uuid4()), "created_at": now, "updated_at": now, "played_at": now,
               "description": "", "listened_seconds": 0, **payload}
        self._rows(table).append(row)
        return [dict(row)]

    async def update(self, table, payload, *, filters, select):
        self.calls.append(("update", table, filters))
        out = []
        for r in self._rows(table):
            if self._match(r, filters):
                r.update(payload)
                out.append(dict(r))
        return out

    async def delete(self, table, *, filters, select="id"):
        self.calls.append(("delete", table, filters))
        keep, gone = [], []
        for r in self._rows(table):
            (gone if self._match(r, filters) else keep).append(r)
        self.store[table] = keep
        return [dict(r) for r in gone]


def client_for(user_id: UUID, db: InMemorySupabase) -> TestClient:
    app = create_app()
    app.dependency_overrides[get_auth_context] = lambda: AuthContext(
        user=AuthenticatedUser(id=user_id, email="x@example.com"), access_token="tok"
    )
    app.dependency_overrides[get_user_supabase] = lambda: db
    app.dependency_overrides[get_settings] = lambda: Settings(
        supabase_url="https://example.supabase.co", supabase_publishable_key="k"
    )
    return TestClient(app)


TRACK = {
    "provider": "spotify",
    "track_id": "4uLU6hMCjMI75M1A2tKUQC",
    "track_name": "Bài hát",
    "artist_name": "Ca sĩ A, Ca sĩ B",
    "album_name": "Album",
    "cover_url": "https://i.scdn.co/image/abc",
    "spotify_url": "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC",
}


# ---------- Chưa đăng nhập ----------
@pytest.mark.parametrize(
    "method,path",
    [
        ("get", "/api/favorites"),
        ("post", "/api/favorites"),
        ("delete", f"/api/favorites/{uuid4()}"),
        ("get", "/api/listening-history"),
        ("post", "/api/listening-history"),
        ("delete", "/api/listening-history"),
        ("delete", f"/api/listening-history/{uuid4()}"),
        ("get", "/api/playlists"),
        ("patch", f"/api/playlists/{uuid4()}"),
        ("delete", f"/api/playlists/{uuid4()}"),
        ("get", f"/api/playlists/{uuid4()}/tracks"),
        ("post", f"/api/playlists/{uuid4()}/tracks"),
        ("delete", f"/api/playlists/{uuid4()}/tracks/{uuid4()}"),
    ],
)
def test_library_endpoints_reject_anonymous(method, path):
    response = getattr(TestClient(create_app()), method)(path)
    assert response.status_code == 401


# ---------- Yêu thích ----------
def test_favorite_add_list_remove_cycle():
    db = InMemorySupabase()
    api = client_for(USER_A, db)

    created = api.post("/api/favorites", json=TRACK)
    assert created.status_code == 201
    body = created.json()
    assert body["user_id"] == str(USER_A)
    assert body["provider"] == "spotify" and body["track_id"] == TRACK["track_id"]
    assert body["cover_url"] == TRACK["cover_url"] and body["artist_name"] == TRACK["artist_name"]

    listed = api.get("/api/favorites").json()
    assert [f["track_id"] for f in listed] == [TRACK["track_id"]]

    assert api.delete(f"/api/favorites/{body['id']}").status_code == 204
    assert api.get("/api/favorites").json() == []


def test_favorite_double_click_does_not_duplicate():
    db = InMemorySupabase()
    api = client_for(USER_A, db)
    first = api.post("/api/favorites", json=TRACK)
    second = api.post("/api/favorites", json=TRACK)
    assert first.status_code == second.status_code == 201
    assert first.json()["id"] == second.json()["id"]
    assert len(api.get("/api/favorites").json()) == 1


def test_favorite_remove_twice_returns_404_second_time():
    db = InMemorySupabase()
    api = client_for(USER_A, db)
    fav_id = api.post("/api/favorites", json=TRACK).json()["id"]
    assert api.delete(f"/api/favorites/{fav_id}").status_code == 204
    assert api.delete(f"/api/favorites/{fav_id}").status_code == 404


def test_favorites_are_isolated_between_users():
    db = InMemorySupabase()
    a, b = client_for(USER_A, db), client_for(USER_B, db)
    fav_id = a.post("/api/favorites", json=TRACK).json()["id"]

    assert b.get("/api/favorites").json() == []          # B không thấy dữ liệu của A
    assert b.delete(f"/api/favorites/{fav_id}").status_code == 404  # B không xóa được
    assert len(a.get("/api/favorites").json()) == 1       # dữ liệu của A còn nguyên

    # Cùng bài hát: mỗi người có bản ghi riêng
    assert b.post("/api/favorites", json=TRACK).status_code == 201
    assert len(b.get("/api/favorites").json()) == 1


def test_favorite_rejects_client_supplied_user_id_and_bad_urls():
    api = client_for(USER_A, InMemorySupabase())
    assert api.post("/api/favorites", json={**TRACK, "user_id": str(USER_B)}).status_code == 422
    assert api.post("/api/favorites", json={**TRACK, "spotify_url": "javascript:alert(1)"}).status_code == 422
    assert api.post("/api/favorites", json={**TRACK, "cover_url": "http://insecure/x.jpg"}).status_code == 422
    assert api.post("/api/favorites", json={**TRACK, "provider": "youtube"}).status_code == 422


def test_favorites_pagination_offset():
    db = InMemorySupabase()
    api = client_for(USER_A, db)
    for i in range(3):
        api.post("/api/favorites", json={**TRACK, "track_id": f"t{i}"})
    assert len(api.get("/api/favorites?limit=2").json()) == 2
    assert len(api.get("/api/favorites?limit=2&offset=2").json()) == 1
    assert api.get("/api/favorites?limit=101").status_code == 422


# ---------- Lịch sử nghe ----------
def test_history_records_new_listen_with_metadata():
    db = InMemorySupabase()
    api = client_for(USER_A, db)
    response = api.post("/api/listening-history", json=TRACK)
    assert response.status_code == 201
    row = response.json()
    assert row["user_id"] == str(USER_A) and row["provider"] == "spotify"
    assert row["track_name"] == "Bài hát"
    assert api.get("/api/listening-history").json()[0]["id"] == row["id"]


def test_history_duplicate_event_within_window_is_not_recorded_twice():
    db = InMemorySupabase()
    api = client_for(USER_A, db)
    first = api.post("/api/listening-history", json=TRACK)
    second = api.post("/api/listening-history", json=TRACK)
    assert first.status_code == 201
    assert second.status_code == 200  # trùng lượt nghe vừa ghi
    assert second.json()["id"] == first.json()["id"]
    assert len(api.get("/api/listening-history").json()) == 1


def test_history_replay_after_window_creates_new_listen():
    db = InMemorySupabase()
    api = client_for(USER_A, db)
    api.post("/api/listening-history", json=TRACK)
    # Lùi thời điểm của lượt nghe cũ để mô phỏng nghe lại sau đó
    db.store["listening_history"][0]["played_at"] = (
        datetime.now(timezone.utc) - timedelta(minutes=3)
    ).isoformat()
    again = api.post("/api/listening-history", json=TRACK)
    assert again.status_code == 201
    assert len(api.get("/api/listening-history").json()) == 2


def test_history_different_tracks_are_both_recorded():
    db = InMemorySupabase()
    api = client_for(USER_A, db)
    assert api.post("/api/listening-history", json=TRACK).status_code == 201
    assert api.post("/api/listening-history", json={**TRACK, "track_id": "other"}).status_code == 201


def test_history_same_track_other_user_is_not_deduped():
    db = InMemorySupabase()
    assert client_for(USER_A, db).post("/api/listening-history", json=TRACK).status_code == 201
    assert client_for(USER_B, db).post("/api/listening-history", json=TRACK).status_code == 201


def test_history_isolated_and_deletable_only_by_owner():
    db = InMemorySupabase()
    a, b = client_for(USER_A, db), client_for(USER_B, db)
    row_id = a.post("/api/listening-history", json=TRACK).json()["id"]
    assert b.get("/api/listening-history").json() == []
    assert b.delete(f"/api/listening-history/{row_id}").status_code == 404
    assert a.delete(f"/api/listening-history/{row_id}").status_code == 204
    assert a.get("/api/listening-history").json() == []


def test_history_clear_only_affects_current_user():
    db = InMemorySupabase()
    a, b = client_for(USER_A, db), client_for(USER_B, db)
    a.post("/api/listening-history", json=TRACK)
    a.post("/api/listening-history", json={**TRACK, "track_id": "x"})
    b.post("/api/listening-history", json=TRACK)
    assert a.delete("/api/listening-history").status_code == 204
    assert a.get("/api/listening-history").json() == []
    assert len(b.get("/api/listening-history").json()) == 1
    # Xóa khi đã trống vẫn thành công (idempotent)
    assert a.delete("/api/listening-history").status_code == 204


def test_history_validation():
    api = client_for(USER_A, InMemorySupabase())
    assert api.post("/api/listening-history", json={**TRACK, "listened_seconds": -1}).status_code == 422
    assert api.post("/api/listening-history", json={**TRACK, "user_id": str(USER_B)}).status_code == 422
    assert api.post("/api/listening-history", json={**TRACK, "track_id": "  "}).status_code == 422


# ---------- Playlist ----------
def make_playlist(api, name="Học bài"):
    response = api.post("/api/playlists", json={"name": name})
    assert response.status_code == 201
    return response.json()["id"]


PL_TRACK = {
    "track_id": TRACK["track_id"],
    "track_name": TRACK["track_name"],
    "artist_name": TRACK["artist_name"],
    "cover_url": TRACK["cover_url"],
    "spotify_url": TRACK["spotify_url"],
    "position": 0,
}


def test_playlist_track_add_list_remove_and_count():
    db = InMemorySupabase()
    api = client_for(USER_A, db)
    pid = make_playlist(api)
    assert api.get("/api/playlists").json()[0]["track_count"] == 0

    added = api.post(f"/api/playlists/{pid}/tracks", json=PL_TRACK)
    assert added.status_code == 201
    assert api.get("/api/playlists").json()[0]["track_count"] == 1
    assert [t["track_name"] for t in api.get(f"/api/playlists/{pid}/tracks").json()] == ["Bài hát"]

    assert api.delete(f"/api/playlists/{pid}/tracks/{added.json()['id']}").status_code == 204
    assert api.get(f"/api/playlists/{pid}/tracks").json() == []
    assert api.get("/api/playlists").json()[0]["track_count"] == 0


def test_playlist_track_duplicate_returns_409():
    db = InMemorySupabase()
    api = client_for(USER_A, db)
    pid = make_playlist(api)
    assert api.post(f"/api/playlists/{pid}/tracks", json=PL_TRACK).status_code == 201
    assert api.post(f"/api/playlists/{pid}/tracks", json=PL_TRACK).status_code == 409
    assert len(api.get(f"/api/playlists/{pid}/tracks").json()) == 1


def test_playlist_cannot_be_read_or_modified_by_other_user():
    db = InMemorySupabase()
    a, b = client_for(USER_A, db), client_for(USER_B, db)
    pid = make_playlist(a)
    track_row = a.post(f"/api/playlists/{pid}/tracks", json=PL_TRACK).json()["id"]

    assert b.get("/api/playlists").json() == []
    assert b.get(f"/api/playlists/{pid}/tracks").status_code == 404
    assert b.post(f"/api/playlists/{pid}/tracks", json={**PL_TRACK, "track_id": "evil"}).status_code == 404
    assert b.delete(f"/api/playlists/{pid}/tracks/{track_row}").status_code == 404
    assert b.patch(f"/api/playlists/{pid}", json={"name": "hack"}).status_code == 404
    assert b.delete(f"/api/playlists/{pid}").status_code == 404

    # Dữ liệu của A không bị ảnh hưởng
    assert a.get("/api/playlists").json()[0]["name"] == "Học bài"
    assert len(a.get(f"/api/playlists/{pid}/tracks").json()) == 1


def test_playlist_rename_and_delete_by_owner():
    db = InMemorySupabase()
    api = client_for(USER_A, db)
    pid = make_playlist(api)
    renamed = api.patch(f"/api/playlists/{pid}", json={"name": "  Tên mới "})
    assert renamed.status_code == 200 and renamed.json()["name"] == "Tên mới"
    assert api.patch(f"/api/playlists/{pid}", json={"name": "   "}).status_code == 422
    assert api.delete(f"/api/playlists/{pid}").status_code == 204
    assert api.get("/api/playlists").json() == []


def test_playlist_track_rejects_non_https_urls():
    db = InMemorySupabase()
    api = client_for(USER_A, db)
    pid = make_playlist(api)
    bad = api.post(f"/api/playlists/{pid}/tracks", json={**PL_TRACK, "spotify_url": "javascript:alert(1)"})
    assert bad.status_code == 422
    assert api.get(f"/api/playlists/{pid}/tracks").json() == []  # không có gì được lưu


def test_rest_client_sends_limit_offset_and_order(monkeypatch):
    """Kiểm tra client PostgREST thật gửi đúng tham số phân trang (không dùng DB giả)."""
    import asyncio

    from app.core import supabase
    from app.core.supabase import SupabaseRestClient

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
            seen.update(method=method, url=url, params=kwargs["params"])
            return FakeResponse()

    monkeypatch.setattr(supabase.httpx, "AsyncClient", lambda **kwargs: FakeHttpClient())
    client = SupabaseRestClient(
        Settings(supabase_url="https://example.supabase.co", supabase_publishable_key="k"), "tok"
    )
    asyncio.run(client.select("favorites", select="id", order="created_at.desc,id.desc", limit=100, offset=200))
    assert seen["params"]["limit"] == "100"
    assert seen["params"]["offset"] == "200"
    assert seen["params"]["order"] == "created_at.desc,id.desc"

    asyncio.run(client.select("favorites", select="id", limit=10))
    assert "offset" not in seen["params"]  # offset 0/None không gửi
