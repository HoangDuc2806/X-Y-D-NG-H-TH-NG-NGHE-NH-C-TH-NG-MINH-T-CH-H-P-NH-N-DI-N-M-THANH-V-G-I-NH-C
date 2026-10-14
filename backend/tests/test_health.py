from fastapi import APIRouter
from fastapi.testclient import TestClient

from app.main import create_app


def test_health_ok():
    client = TestClient(create_app())
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_validation_error_format():
    app = create_app()
    router = APIRouter()

    @router.get("/api/_t")
    def t(n: int):
        return {"n": n}

    app.include_router(router)
    r = TestClient(app).get("/api/_t?n=abc")
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "validation_error"


def test_unhandled_error_hides_details():
    app = create_app()
    router = APIRouter()

    @router.get("/api/_boom")
    def boom():
        raise RuntimeError("secret-detail")

    app.include_router(router)
    r = TestClient(app, raise_server_exceptions=False).get("/api/_boom")
    assert r.status_code == 500
    assert "secret-detail" not in r.text


def test_cors_allows_configured_origin():
    client = TestClient(create_app())
    r = client.options(
        "/api/health",
        headers={"Origin": "http://localhost:3000", "Access-Control-Request-Method": "GET"},
    )
    assert r.headers.get("access-control-allow-origin") == "http://localhost:3000"
