import os
from datetime import datetime, timezone
from typing import Any, Literal

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

TWELVE_DATA_URL = "https://api.twelvedata.com/quote"
SYMBOLS = ("EUR/USD", "GBP/USD", "XAU/USD")

app = FastAPI(title="NOVA Unified Intelligence API", version="0.3.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict to trusted app origins before production.
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=12)


def ai_configuration() -> tuple[str, str, str]:
    api_key = os.getenv("NOVA_AI_API_KEY", "").strip()
    base_url = os.getenv("NOVA_AI_BASE_URL", "https://api.openai.com/v1").strip().rstrip("/")
    model = os.getenv("NOVA_AI_MODEL", "gpt-4.1-mini").strip()
    return api_key, base_url, model


@app.get("/health")
async def health() -> dict[str, Any]:
    ai_key, _, _ = ai_configuration()
    return {
        "status": "ok",
        "provider": "Twelve Data",
        "provider_configured": bool(os.getenv("TWELVE_DATA_API_KEY", "").strip()),
        "ai_configured": bool(ai_key),
        "mode": "read-only",
    }


@app.get("/api/core/status")
async def core_status() -> dict[str, str | bool]:
    api_key, _, model = ai_configuration()
    return {
        "status": "ready" if api_key else "needs_configuration",
        "configured": bool(api_key),
        "provider": "OpenAI-compatible API",
        "model": model,
        "mode": "advisory; no external actions",
    }


@app.post("/api/core/chat")
async def core_chat(request: ChatRequest) -> dict[str, str]:
    api_key, base_url, model = ai_configuration()
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="NOVA Core is not configured yet. Set NOVA_AI_API_KEY on the backend host; never put it in the mobile app.",
        )

    system_prompt = (
        "You are NOVA, a unified AI assistant focused on deep reasoning, research planning, "
        "software development, business strategy, and careful analysis. Understand the user's "
        "objective, reason step by step internally, compare options, state assumptions, and give "
        "clear actionable plans. Be honest about uncertainty and current information. Do not claim "
        "to have browsed the web, accessed accounts, changed files, placed trades, or controlled "
        "machines unless a connected tool actually confirms that action. This prototype has no "
        "tools and cannot execute external actions. For financial topics, provide educational "
        "analysis, explain uncertainty and risk, and never promise returns. Ask for clarification "
        "when a missing detail materially changes the answer. External actions always require "
        "separate integrations, permissions, and appropriate human approval."
    )
    payload = {
        "model": model,
        "messages": [{"role": "system", "content": system_prompt}]
        + [item.model_dump() for item in request.messages],
        "temperature": 0.4,
    }

    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            response = await client.post(
                f"{base_url}/chat/completions",
                json=payload,
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            )
            response.raise_for_status()
            data = response.json()
        reply = data["choices"][0]["message"]["content"]
        if not isinstance(reply, str) or not reply.strip():
            raise ValueError("Empty model response")
        return {"reply": reply.strip(), "model": model, "created_at": datetime.now(timezone.utc).isoformat()}
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="NOVA's AI provider timed out. Please try again.")
    except httpx.HTTPStatusError as exc:
        # Avoid forwarding provider response bodies that might contain sensitive diagnostics.
        raise HTTPException(status_code=502, detail=f"NOVA's AI provider returned HTTP {exc.response.status_code}. Check the backend provider configuration.")
    except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError):
        raise HTTPException(status_code=502, detail="NOVA could not process the AI provider response. Please try again.")


@app.get("/api/markets/status")
async def market_status() -> dict[str, Any]:
    configured = bool(os.getenv("TWELVE_DATA_API_KEY", "").strip())
    return {
        "status": "connected" if configured else "needs_configuration",
        "configured": configured,
        "provider": "Twelve Data",
        "symbols": list(SYMBOLS),
        "mode": "read-only",
        "refresh_interval_seconds": 60,
    }


@app.get("/api/markets")
async def markets() -> dict[str, Any]:
    api_key = os.getenv("TWELVE_DATA_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="Market-data provider is not configured on the server. No sample prices are provided.",
        )

    quotes: list[dict[str, Any]] = []
    errors: list[str] = []

    async with httpx.AsyncClient(timeout=15.0) as client:
        for symbol in SYMBOLS:
            try:
                response = await client.get(
                    TWELVE_DATA_URL,
                    params={"symbol": symbol},
                    headers={"Authorization": f"apikey {api_key}"},
                )
                response.raise_for_status()
                payload = response.json()
                if payload.get("status") == "error" or payload.get("code"):
                    errors.append(f"{symbol}: {payload.get('message', 'Provider error')}")
                    continue
                raw_price = payload.get("close") or payload.get("price")
                try:
                    numeric_price = float(raw_price)
                except (TypeError, ValueError):
                    errors.append(f"{symbol}: provider returned an invalid price")
                    continue
                if numeric_price <= 0 or not __import__("math").isfinite(numeric_price):
                    errors.append(f"{symbol}: provider returned an invalid price")
                    continue
                quotes.append({
                    "symbol": symbol,
                    "price": str(raw_price),
                    "quote_time": payload.get("datetime") or payload.get("timestamp"),
                    "source": "Twelve Data",
                    "currency": payload.get("currency"),
                })
            except (httpx.HTTPError, ValueError) as exc:
                errors.append(f"{symbol}: {type(exc).__name__}")

    if not quotes:
        raise HTTPException(
            status_code=502,
            detail="No verified market quotes were returned. " + "; ".join(errors),
        )

    return {
        "status": "partial" if errors else "ok",
        "data": quotes,
        "errors": errors,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "mode": "read-only",
    }
