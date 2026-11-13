import math
import os
from datetime import datetime, timezone
from typing import Any, Literal

import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

TWELVE_DATA_URL = "https://api.twelvedata.com/quote"
TWELVE_DATA_SERIES_URL = "https://api.twelvedata.com/time_series"
TWELVE_DATA_API_KEY = os.getenv("TWELVE_DATA_API_KEY", "").strip()
AI_API_KEY = os.getenv("NOVA_AI_API_KEY", "").strip()
AI_BASE_URL = os.getenv("NOVA_AI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
AI_MODEL = os.getenv("NOVA_AI_MODEL", "gpt-4o-mini").strip()
SYMBOLS = ("EUR/USD", "GBP/USD", "USD/JPY", "USD/CHF", "XAU/USD", "XAG/USD", "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "TSLA", "BTC/USD", "ETH/USD")
DEFAULT_SYMBOLS = ("EUR/USD", "GBP/USD", "XAU/USD")
SERIES_RANGES = {"1D": ("15min", 26), "1W": ("1h", 35), "1M": ("1day", 30), "3M": ("1day", 90), "1Y": ("1day", 252)}

cors_origins = [
    origin.strip()
    for origin in os.getenv("NOVA_CORS_ORIGINS", "http://localhost:8081,http://localhost:19006").split(",")
    if origin.strip()
]

app = FastAPI(title="NOVA API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=6000)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=6000)
    history: list[ChatMessage] = Field(default_factory=list, max_length=12)


NOVA_SYSTEM_PROMPT = """You are NOVA, a capable personal intelligence and productivity assistant.
Help the user reason clearly, research, plan projects, compare options, learn, and turn goals into practical next steps.
Be honest about uncertainty and never invent sources, live data, completed actions, or capabilities.
When a task is complex, organize the response into a short plan, work through it carefully, and check the result for gaps before answering.
Use conversation history only as context; do not claim to have persistent memory between sessions.
Do not claim to browse the web, access private accounts, change files, send messages, or execute external actions unless a connected tool actually performed that action.
Ask for confirmation before consequential external actions. Keep financial market information educational and read-only; do not place trades.
Never provide instructions that facilitate violence, weapons use, dangerous wrongdoing, or unsafe control of physical equipment.
Prefer concise, structured, practical answers. If key information is missing, ask one focused question."""


@app.get("/health")
async def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "market_provider_configured": bool(TWELVE_DATA_API_KEY),
        "ai_provider_configured": bool(AI_API_KEY),
        "ai_model_configured": bool(AI_MODEL),
        "mode": "read-only markets; conversational AI",
    }


@app.get("/api/core/status")
async def core_status() -> dict[str, Any]:
    return {
        "status": "ready" if AI_API_KEY else "needs_configuration",
        "configured": bool(AI_API_KEY),
        "provider": "OpenAI-compatible API",
        "model": AI_MODEL,
        "mode": "advisory; no external actions",
    }


@app.get("/api/markets/status")
async def market_status() -> dict[str, Any]:
    configured = bool(TWELVE_DATA_API_KEY)
    return {
        "status": "connected" if configured else "needs_configuration",
        "configured": configured,
        "provider": "Twelve Data",
        "symbols": list(SYMBOLS),
        "mode": "read-only",
    }


@app.get("/api/markets")
async def markets(symbols: str | None = Query(default=None, max_length=500)) -> dict[str, Any]:
    if not TWELVE_DATA_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="Market-data provider is not configured on the server. No sample prices are provided.",
        )

    requested = [item.strip().upper() for item in symbols.split(",")] if symbols else list(DEFAULT_SYMBOLS)
    requested = list(dict.fromkeys(requested))
    if not requested or len(requested) > 14 or any(item not in SYMBOLS for item in requested):
        raise HTTPException(status_code=400, detail="One or more requested symbols are not supported.")
    quotes: list[dict[str, Any]] = []
    errors: list[str] = []

    async with httpx.AsyncClient(timeout=15.0) as client:
        for symbol in requested:
            try:
                response = await client.get(
                    TWELVE_DATA_URL,
                    params={"symbol": symbol},
                    headers={"Authorization": f"apikey {TWELVE_DATA_API_KEY}"},
                )
                response.raise_for_status()
                payload = response.json()

                if payload.get("status") == "error" or payload.get("code"):
                    errors.append(f"{symbol}: {payload.get('message', 'Provider error')}")
                    continue

                raw_price = payload.get("close") or payload.get("price")
                if raw_price is None:
                    errors.append(f"{symbol}: provider did not return a price")
                    continue
                try:
                    numeric_price = float(raw_price)
                except (TypeError, ValueError):
                    errors.append(f"{symbol}: provider returned an invalid price")
                    continue
                if numeric_price <= 0 or not math.isfinite(numeric_price):
                    errors.append(f"{symbol}: provider returned an invalid price")
                    continue

                quotes.append({
                    "symbol": symbol,
                    "price": str(raw_price),
                    "quote_time": payload.get("datetime") or payload.get("timestamp"),
                    "source": "Twelve Data",
                    "currency": payload.get("currency"),
                })
            except (httpx.HTTPError, ValueError):
                errors.append(f"{symbol}: provider request failed")

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


@app.get("/api/markets/series")
async def market_series(
    symbol: str = Query(..., min_length=3, max_length=16),
    range: str = Query(default="1M", alias="range"),
) -> dict[str, Any]:
    normalized = symbol.strip().upper()
    if normalized not in SYMBOLS:
        raise HTTPException(status_code=400, detail="This instrument is not supported.")
    if range not in SERIES_RANGES:
        raise HTTPException(status_code=400, detail="Unsupported chart range.")
    if not TWELVE_DATA_API_KEY:
        raise HTTPException(status_code=503, detail="Market-data provider is not configured on the server.")
    interval, outputsize = SERIES_RANGES[range]
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.get(
                TWELVE_DATA_SERIES_URL,
                params={"symbol": normalized, "interval": interval, "outputsize": outputsize, "order": "ASC"},
                headers={"Authorization": f"apikey {TWELVE_DATA_API_KEY}"},
            )
            response.raise_for_status()
            payload = response.json()
        if payload.get("status") == "error" or payload.get("code"):
            raise HTTPException(status_code=502, detail=payload.get("message", "The provider could not return chart history."))
        values = payload.get("values")
        if not isinstance(values, list) or not values:
            raise HTTPException(status_code=502, detail="No historical chart data was returned by the provider.")
        points: list[dict[str, Any]] = []
        for item in values:
            try:
                close = float(item.get("close"))
                if math.isfinite(close) and close > 0:
                    points.append({"time": item.get("datetime"), "close": close})
            except (TypeError, ValueError, AttributeError):
                continue
        if not points:
            raise HTTPException(status_code=502, detail="The provider returned no valid historical prices.")
        return {"symbol": normalized, "range": range, "interval": interval, "source": "Twelve Data", "fetched_at": datetime.now(timezone.utc).isoformat(), "data": points, "mode": "read-only"}
    except HTTPException:
        raise
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Could not retrieve historical prices from the market-data provider.")


@app.post("/api/core/chat")
async def chat(payload: ChatRequest) -> dict[str, Any]:
    if not AI_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="AI is not configured. Add NOVA_AI_API_KEY to the backend environment.",
        )

    # Keep only the most recent turns and cap the full prompt size.
    history = payload.history[-12:]
    messages = [{"role": "system", "content": NOVA_SYSTEM_PROMPT}]
    messages.extend({"role": item.role, "content": item.content} for item in history)
    messages.append({"role": "user", "content": payload.message})

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(45.0, connect=10.0)) as client:
            response = await client.post(
                f"{AI_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {AI_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": AI_MODEL,
                    "messages": messages,
                    "temperature": 0.4,
                },
            )
            response.raise_for_status()
            result = response.json()
            reply = result["choices"][0]["message"]["content"]
            if isinstance(reply, list):
                reply = "".join(
                    part.get("text", "") for part in reply if isinstance(part, dict)
                )
            if not isinstance(reply, str) or not reply.strip():
                raise ValueError("Empty model response")
            return {
                "reply": reply.strip(),
                "model": AI_MODEL,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="NOVA's AI provider timed out. Please try again.")
    except httpx.HTTPStatusError as exc:
        status = exc.response.status_code
        if status in (401, 403):
            raise HTTPException(status_code=502, detail="The AI provider rejected the server credentials.")
        if status == 429:
            raise HTTPException(status_code=503, detail="The AI provider is rate-limiting requests. Try again shortly.")
        raise HTTPException(status_code=502, detail=f"The AI provider returned HTTP {status}.")
    except (httpx.HTTPError, KeyError, IndexError, ValueError):
        raise HTTPException(status_code=502, detail="NOVA could not read a valid response from its AI provider.")
