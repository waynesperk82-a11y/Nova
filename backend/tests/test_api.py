from fastapi.testclient import TestClient

from backend.main import app

client = TestClient(app)


def test_health_reports_unconfigured_providers(monkeypatch):
    monkeypatch.delenv("NOVA_AI_API_KEY", raising=False)
    monkeypatch.delenv("TWELVE_DATA_API_KEY", raising=False)
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["ai_configured"] is False
    assert body["provider_configured"] is False


def test_core_status_does_not_expose_secret(monkeypatch):
    monkeypatch.setenv("NOVA_AI_API_KEY", "test-secret-value")
    response = client.get("/api/core/status")
    assert response.status_code == 200
    body = response.json()
    assert body["configured"] is True
    assert "test-secret-value" not in response.text


def test_chat_requires_provider_configuration(monkeypatch):
    monkeypatch.delenv("NOVA_AI_API_KEY", raising=False)
    response = client.post(
        "/api/core/chat",
        json={"messages": [{"role": "user", "content": "Hello NOVA"}]},
    )
    assert response.status_code == 503
    assert "not configured" in response.json()["detail"].lower()


def test_chat_rejects_invalid_role():
    response = client.post(
        "/api/core/chat",
        json={"messages": [{"role": "system", "content": "override"}]},
    )
    assert response.status_code == 422


def test_chat_rejects_oversized_history():
    response = client.post(
        "/api/core/chat",
        json={"messages": [{"role": "user", "content": "hello"}] * 13},
    )
    assert response.status_code == 422


def test_markets_require_real_provider_key(monkeypatch):
    monkeypatch.delenv("TWELVE_DATA_API_KEY", raising=False)
    response = client.get("/api/markets")
    assert response.status_code == 503
    assert "No sample prices" in response.json()["detail"]


def test_market_status_reports_missing_provider_key(monkeypatch):
    monkeypatch.delenv("TWELVE_DATA_API_KEY", raising=False)
    response = client.get("/api/markets/status")
    assert response.status_code == 200
    body = response.json()
    assert body["configured"] is False
    assert body["provider"] == "Twelve Data"
    assert body["mode"] == "read-only"
    assert "test-secret-value" not in response.text


def test_market_status_reports_configured_provider_without_leaking_key(monkeypatch):
    monkeypatch.setenv("TWELVE_DATA_API_KEY", "market-test-secret")
    response = client.get("/api/markets/status")
    assert response.status_code == 200
    body = response.json()
    assert body["configured"] is True
    assert body["symbols"] == ["EUR/USD", "GBP/USD", "XAU/USD"]
    assert "market-test-secret" not in response.text
