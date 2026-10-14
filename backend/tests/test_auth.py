from uuid import UUID
import pytest
import httpx
from fastapi.testclient import TestClient
from app.main import create_app
from app.core.auth import get_current_user, AuthenticatedUser
from app.core.config import get_settings, Settings

USER_ID = UUID("c924b932-e8d5-4fb2-9f43-0ed81066cc29")

def test_me_requires_bearer_token():
    r = TestClient(create_app()).get("/api/me")
    assert r.status_code == 401

def test_me_not_configured_fails_closed():
    app = create_app()
    app.dependency_overrides[get_settings] = lambda: Settings(supabase_url="", supabase_publishable_key="")
    r = TestClient(app).get("/api/me", headers={"Authorization": "Bearer anything"})
    assert r.status_code == 503

def test_me_authenticated_dependency():
    app = create_app()
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(id=USER_ID, email="user@example.org")
    r = TestClient(app).get("/api/me")
    assert r.status_code == 200
    assert r.json() == {"id": str(USER_ID), "email": "user@example.org"}

@pytest.mark.parametrize("upstream, expected", [(400,401),(401,401),(403,401),(500,503)])
def test_supabase_auth_failure(monkeypatch, upstream, expected):
    from app.core import auth
    class FakeClient:
        async def __aenter__(self): return self
        async def __aexit__(self, *args): pass
        async def get(self, url, headers):
            assert headers["Authorization"] == "Bearer test-token"
            assert url == "https://example.supabase.co/auth/v1/user"
            return httpx.Response(upstream, request=httpx.Request("GET",url))
    monkeypatch.setattr(auth.httpx, "AsyncClient", lambda **kwargs: FakeClient())
    app = create_app()
    app.dependency_overrides[get_settings] = lambda: Settings(
        supabase_url="https://example.supabase.co", supabase_publishable_key="public-key")
    r = TestClient(app).get("/api/me", headers={"Authorization": "Bearer test-token"})
    assert r.status_code == expected

def test_supabase_auth_success(monkeypatch):
    from app.core import auth
    class FakeClient:
        async def __aenter__(self): return self
        async def __aexit__(self, *args): pass
        async def get(self, url, headers):
            return httpx.Response(200, json={"id":str(USER_ID),"email":"member@example.com"},request=httpx.Request("GET",url))
    monkeypatch.setattr(auth.httpx, "AsyncClient", lambda **kwargs: FakeClient())
    app = create_app()
    app.dependency_overrides[get_settings] = lambda: Settings(supabase_url="https://example.supabase.co",supabase_publishable_key="key")
    r = TestClient(app).get("/api/me", headers={"Authorization":"Bearer token"})
    assert r.status_code == 200 and r.json()["id"] == str(USER_ID)
