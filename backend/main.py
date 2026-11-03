import os
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

TWELVE_DATA_URL = "https://api.twelvedata.com/quote"
API_KEY = os.getenv("TWELVE_DATA_API_KEY", "").strip()
SYMBOLS = ("EUR/USD", "GBP/USD", "XAU/USD")

app = FastAPI(title="NOVA Read-only Market Data API", version="0.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict this to your app's trusted origins when deploying.
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "provider": "Twelve Data",
        "provider_configured": bool(API_KEY),
        "mode": "read-only",
    }


@app.get("/api/markets")
async def markets() -> dict[str, Any]:
    if not API_KEY:
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
                    headers={"Authorization": f"apikey {API_KEY}"},
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

                # Keep provider values as strings; never manufacture or interpolate prices.
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
