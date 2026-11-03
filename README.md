# NOVA — Unified Intelligence Prototype

Android-first AI workspace with a central NOVA Core, an OpenAI-compatible chat connection, and a read-only real-market-data dashboard.

## Current capabilities

- **NOVA Core chat:** sends a bounded conversation to a configured OpenAI-compatible chat-completions API.
- **Core status:** reports whether an AI provider key is configured without exposing credentials.
- **Market dashboard:** requests EUR/USD, GBP/USD, and XAU/USD quotes from Twelve Data.
- **Honest unavailable states:** no fabricated market prices, simulated balances, sample profit/loss, or pretend AI responses.
- **Permission boundary:** this version is advisory. It has no broker connection, order endpoint, web-browsing tool, or machine-control capability.

## Architecture

- `App.tsx`: Expo / React Native Android interface.
- `backend/main.py`: FastAPI service for NOVA Core and market data.
- `NOVA_AI_API_KEY`: private backend environment variable for an OpenAI-compatible API.
- `NOVA_AI_BASE_URL`: optional API base URL; defaults to `https://api.openai.com/v1`.
- `NOVA_AI_MODEL`: optional model name; defaults to `gpt-4.1-mini`.
- `TWELVE_DATA_API_KEY`: private market-data provider key.
- `EXPO_PUBLIC_NOVA_API_URL`: HTTPS base URL of the deployed backend. This value is public and must never contain a secret.

Never commit API keys or put them in Expo public environment variables.

## Configure NOVA Core

On the backend host, set:

- `NOVA_AI_API_KEY` to your provider key.
- Optionally set `NOVA_AI_BASE_URL` and `NOVA_AI_MODEL` for a compatible provider/model.

The mobile app calls:

- `GET /api/core/status`
- `POST /api/core/chat`

If the AI key is missing, NOVA returns an explicit setup message rather than pretending to think.

## Configure real market data

Set `TWELVE_DATA_API_KEY` as a private backend environment variable. Provider plans may have symbol, latency, and request-limit restrictions. Provider timestamps and entitlements determine freshness.

## Run the backend locally

```bash
cd backend
python -m venv .venv
# Activate the virtual environment, then:
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

## Run the Android app

```bash
npm install
```

Set `EXPO_PUBLIC_NOVA_API_URL` to the backend URL, then:

```bash
npx expo start
```

## API

- `GET /health`: reports backend and provider configuration without returning secrets.
- `GET /api/core/status`: reports whether NOVA Core is configured.
- `POST /api/core/chat`: returns a model-generated advisory response.
- `GET /api/markets`: returns genuine provider quotes or an explicit error.

## Next engineering milestones

1. Add persistent, user-controlled conversation memory.
2. Add a research connector with citations and source timestamps.
3. Add a typed planning/task engine with visible approval checkpoints.
4. Add authenticated users, rate limits, audit logs, and per-capability permissions.
5. Add broker integrations only after secure credential handling, sandbox validation, and explicit trade approvals.
6. Add machine/industrial integrations through isolated adapters, simulation environments, safety interlocks, and human supervision.

NOVA's central intelligence can coordinate these capabilities, but this prototype does not yet implement autonomous agents or external action execution.
