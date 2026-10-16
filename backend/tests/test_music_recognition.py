from uuid import UUID

from fastapi.testclient import TestClient

from app.core.auth import AuthContext, AuthenticatedUser, get_auth_context
from app.core.config import Settings, get_settings
from app.main import create_app

USER_ID = UUID("c924b932-e8d5-4fb2-9f43-0ed81066cc29")


def make_app(settings: Settings | None = None):
    app = create_app()
    app.dependency_overrides[get_auth_context] = lambda: AuthContext(
        user=AuthenticatedUser(id=USER_ID, email="member@example.com"),
        access_token="user-access-token",
    )
    app.dependency_overrides[get_settings] = lambda: settings or Settings(
        supabase_url="https://example.supabase.co",
        supabase_publishable_key="publishable-key",
        acoustid_client_key="test-acoustid-key",
    )
    return app


def test_identify_requires_authentication():
    client = TestClient(create_app())
    response = client.post(
        "/api/identify",
        files={"file": ("sample.wav", b"fake audio", "audio/wav")},
    )
    assert response.status_code == 401


def test_identify_returns_music_metadata(monkeypatch):
    from app.routers import identify

    async def fake_fingerprint(*args, **kwargs):
        return 18, "fingerprint-value"

    async def fake_lookup(client_key, fingerprint, duration):
        assert client_key == "test-acoustid-key"
        assert fingerprint == "fingerprint-value"
        assert duration == 18
        return {
            "status": "ok",
            "results": [{
                "id": "acoustid-track-id",
                "score": 0.94,
                "recordings": [{
                    "id": "musicbrainz-recording-id",
                    "title": "Bài hát thử nghiệm",
                    "artists": [{"name": "Nghệ sĩ thử nghiệm"}],
                    "releasegroups": [{"title": "Album thử nghiệm", "firstreleasedate": "2021-06-10"}],
                }],
            }],
        }

    monkeypatch.setattr(identify, "generate_fingerprint", fake_fingerprint)
    monkeypatch.setattr(identify, "lookup_acoustid", fake_lookup)
    client = TestClient(make_app())
    response = client.post(
        "/api/identify",
        files={"file": ("sample.wav", b"fake audio", "audio/wav")},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "matched"
    assert body["duration_seconds"] == 18
    assert body["results"][0]["title"] == "Bài hát thử nghiệm"
    assert body["results"][0]["artists"] == ["Nghệ sĩ thử nghiệm"]
    assert body["results"][0]["album"] == "Album thử nghiệm"
    assert body["results"][0]["year"] == 2021
    assert body["results"][0]["score"] == 0.94


def test_identify_requires_acoustid_configuration(monkeypatch):
    from app.routers import identify

    async def should_not_run(*args, **kwargs):
        raise AssertionError("fingerprinting should not run without API key")

    monkeypatch.setattr(identify, "generate_fingerprint", should_not_run)
    settings = Settings(
        supabase_url="https://example.supabase.co",
        supabase_publishable_key="publishable-key",
        acoustid_client_key="",
    )
    client = TestClient(make_app(settings))
    response = client.post(
        "/api/identify",
        files={"file": ("sample.wav", b"fake audio", "audio/wav")},
    )
    assert response.status_code == 503
    assert "ACOUSTID_CLIENT_KEY" in response.json()["error"]["message"]


def test_identify_rejects_unsupported_file_type():
    client = TestClient(make_app())
    response = client.post(
        "/api/identify",
        files={"file": ("document.pdf", b"not audio", "application/pdf")},
    )
    assert response.status_code == 415


def test_identify_rejects_file_over_configured_size_limit(monkeypatch):
    from app.routers import identify

    async def should_not_run(*args, **kwargs):
        raise AssertionError("fingerprinting should not run for oversized uploads")

    monkeypatch.setattr(identify, "generate_fingerprint", should_not_run)
    settings = Settings(
        supabase_url="https://example.supabase.co",
        supabase_publishable_key="publishable-key",
        acoustid_client_key="test-acoustid-key",
        recognition_max_upload_bytes=4,
    )
    client = TestClient(make_app(settings))
    response = client.post(
        "/api/identify",
        files={"file": ("sample.wav", b"12345", "audio/wav")},
    )
    assert response.status_code == 413


def test_identify_rejects_audio_that_is_too_short(monkeypatch):
    from app.routers import identify

    async def fake_fingerprint(*args, **kwargs):
        return 3, "short-fingerprint"

    async def should_not_lookup(*args, **kwargs):
        raise AssertionError("AcoustID should not be queried for clips that are too short")

    monkeypatch.setattr(identify, "generate_fingerprint", fake_fingerprint)
    monkeypatch.setattr(identify, "lookup_acoustid", should_not_lookup)
    client = TestClient(make_app())
    response = client.post(
        "/api/identify",
        files={"file": ("sample.wav", b"fake audio", "audio/wav")},
    )
    assert response.status_code == 422


def test_identify_returns_not_found_when_no_recording_matches(monkeypatch):
    from app.routers import identify

    async def fake_fingerprint(*args, **kwargs):
        return 18, "fingerprint-value"

    async def fake_lookup(*args, **kwargs):
        return {"status": "ok", "results": []}

    monkeypatch.setattr(identify, "generate_fingerprint", fake_fingerprint)
    monkeypatch.setattr(identify, "lookup_acoustid", fake_lookup)
    client = TestClient(make_app())
    response = client.post(
        "/api/identify",
        files={"file": ("sample.wav", b"fake audio", "audio/wav")},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "not_found"
    assert response.json()["results"] == []
