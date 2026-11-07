# NOVA 2.0

Android-first personal intelligence workspace built with Expo / React Native and a FastAPI backend.

## What is in this repository

- **Home** — workspace overview and navigation.
- **Intelligence** — conversational AI interface backed by a configurable OpenAI-compatible chat-completions API.
- **Markets** — read-only EUR/USD, GBP/USD and XAU/USD quotes from Twelve Data.
- **Workspace** — a lightweight local task list. Tasks currently live in app memory and are not synced or persisted to an account.
- **Backend** — FastAPI service for AI chat and verified market-data requests.

## AI provider configuration

The backend supports providers that expose an OpenAI-compatible `/chat/completions` endpoint. This lets the deployment choose a compatible provider/model without putting credentials in the mobile app.

Set these environment variables on the backend host:

| Variable | Required | Purpose |
| --- | --- | --- |
| `NOVA_AI_API_KEY` | Yes for chat | Secret API key for the selected AI provider |
| `NOVA_AI_BASE_URL` | No | API base URL; defaults to `https://api.openai.com/v1` |
| `NOVA_AI_MODEL` | No | Model name; defaults to `gpt-4o-mini` |
| `NOVA_CORS_ORIGINS` | No | Comma-separated browser origins; defaults to local Expo web origins |
| `TWELVE_DATA_API_KEY` | Yes for markets | Twelve Data API key |

Never put provider keys in `App.tsx`, Expo public variables, or GitHub. The app only needs the public backend URL:

`EXPO_PUBLIC_NOVA_API_URL=https://YOUR-BACKEND-HOST`

The app can use a different compatible AI provider by changing the backend environment variables; confirm that provider's endpoint, model name, account access and pricing before deployment.

## Local setup

### Backend

```bash
cd backend
python -m venv .venv
# Activate the virtual environment
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Set the backend environment variables in your local shell or deployment dashboard. Do not commit a real `.env` file.

### Android app

```bash
npm install
```

Set `EXPO_PUBLIC_NOVA_API_URL` in the Expo environment, then run:

```bash
npx expo start
```

Open the project using Expo Go or a configured Android development build.

## API

- `GET /health` — reports whether AI and market provider keys are configured; never returns credentials.
- `GET /api/markets` — returns provider-supplied quotes or an explicit error. No sample prices are generated.
- `POST /api/core/chat` — accepts a message and up to 12 prior conversation turns; returns the AI provider's reply.

Example chat request:

```json
{
  "message": "Help me break my project into milestones.",
  "history": []
}
```

## Current limitations — stated clearly

- There is no persistent user memory, login, cloud task sync, team workspace, or connected external-tool execution yet.
- Conversation history is held in the running app session; it is not a cross-session memory store.
- The AI endpoint is conversational. It does not autonomously execute actions in other services.
- The markets feature is informational and read-only. There is no broker connection or order execution.
- A configured Twelve Data account may have symbol, latency, quota and real-time entitlement limits. Displayed timestamps and provider entitlements determine freshness.
- The repository update does not itself deploy the backend, provision API keys, or produce an installable Android APK.

## Safety and data integrity

NOVA should be transparent about uncertainty, avoid inventing data or completed actions, and require human approval for consequential external actions. Keep all API secrets on the server. Do not use this application to control weapons or dangerous physical equipment.
