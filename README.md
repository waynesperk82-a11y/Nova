# NOVA 2.0 — Personal Intelligence Workspace

NOVA is an Android-first, cross-platform AI workspace built with Expo / React Native and a FastAPI backend. The same interface code targets Android, iOS and the web. On Windows, macOS and Linux, the web app is the computer experience; this repository does not package native desktop binaries.

## Current app areas

- **Home:** workspace overview and navigation.
- **Intelligence:** conversational AI using a configurable OpenAI-compatible API.
- **Markets:** read-only EUR/USD, GBP/USD and XAU/USD data from Twelve Data.
- **Workspace:** local task list; tasks are currently held in app memory and are not synced to an account.

NOVA is an advisory prototype. It does not browse the web, connect to broker accounts, place trades, or control physical equipment.

## Automation product research and NOVA lessons

See [the LhamaBot public-information review](docs/research/automation-safety-lessons.md). It treats the platform's promotional performance claims as unverified and does not endorse the service.

NOVA adopts these safeguards:
- Show the provider and source timestamp for every market quote; distinguish provider time from NOVA retrieval time.
- Never invent missing prices or present unverified promotional performance as fact.
- Keep market connections read-only. No broker order placement, withdrawal permissions, wallet signing or credential collection.
- Keep API secrets server-side and use the least privilege available.
- Require explicit human approval before any future consequential external action.
- Make uncertainty and unavailable data visible rather than hiding them.

## Architecture

- `App.tsx`: Expo / React Native client.
- `backend/main.py`: FastAPI service for AI chat and read-only market data.
- `vercel.json`: Vercel FastAPI function settings.
- `backend/tests/`: API contract and safety checks.
- `eas.json`: EAS build profiles for Android and iOS.
- `.github/workflows/ci.yml`: TypeScript, web-export and backend-test checks.
- `docs/research/`: point-in-time product/security research.

## Requirements

- Node.js 20 or newer and npm.
- Python 3.11 or newer for backend development.
- Expo Go for quick device preview, or EAS Build for installable Android/iOS builds.
- A deployed HTTPS backend for real devices outside your local network.

## Configure environment variables

Set these on the backend host only:
- `NOVA_AI_API_KEY`: private key for the selected AI provider.
- `NOVA_AI_BASE_URL`: optional OpenAI-compatible API base URL.
- `NOVA_AI_MODEL`: optional model name.
- `NOVA_CORS_ORIGINS`: comma-separated trusted browser origins.
- `TWELVE_DATA_API_KEY`: private market-data provider key.

Set `EXPO_PUBLIC_NOVA_API_URL` in the Expo/EAS build environment to the HTTPS base URL of the deployed backend. This URL is public by design; never put a secret in an `EXPO_PUBLIC_*` variable.

## Deploy backend to Vercel

The connected Vercel project is named `nova-api` and uses FastAPI. Configure its root directory and environment variables in Vercel project settings. Deploy a Preview first and verify:
- `GET /health`
- `GET /api/core/status`
- `POST /api/core/chat`
- `GET /api/markets/status`
- `GET /api/markets`

Before unrestricted public use, add authentication, per-user authorization, request throttling, abuse protection, monitoring and audit logging. Restrict browser CORS to the intended web origins. A successful build alone does not prove provider credentials or runtime requests work.

## Run the app

```bash
npm install
npx expo start
```

Press `a` for Android (with Android tooling installed), `i` for the iOS Simulator on macOS, or `w` for web. To export the web app:

```bash
npm run export:web
```

## Build installable mobile apps

Authenticate with your Expo account and use the EAS profiles:

```bash
npx eas-cli login
npx eas-cli build --platform android --profile preview
npx eas-cli build --platform ios --profile preview
```

The Android Preview profile produces an installable APK. The Production profile produces an Android App Bundle. iOS device distribution normally requires Apple signing credentials and an eligible Apple Developer account.

## Run the backend locally

```bash
cd backend
python -m venv .venv
# Activate the environment, then:
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

For a physical phone, use a reachable LAN address or deployed HTTPS URL; `localhost` on the phone does not point to your computer.

## API endpoints

- `GET /health` — provider configuration status; no secrets returned.
- `GET /api/core/status` — AI provider configuration status; no secrets returned.
- `POST /api/core/chat` — bounded conversation history and a server-side AI request.
- `GET /api/markets/status` — market-provider configuration status.
- `GET /api/markets` — verified provider quotes or an explicit unavailable/error response.

## Production-readiness limits

Persistent memory, accounts, cloud task sync, shared workspaces and external tool execution are not implemented. The current chat is conversational only and does not claim to perform actions in other services. Do not expose paid AI calls publicly until authentication and abuse controls are in place.
