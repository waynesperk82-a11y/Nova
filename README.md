# NOVA — Cross-platform unified intelligence

NOVA is an Android-first, cross-platform AI workspace built with Expo / React Native and a FastAPI backend. One shared mobile/web codebase targets Android, iOS/iPadOS, and the web. On Windows, macOS, and Linux, users can run the web app in a modern browser.

## Platform support

| Platform | Delivery |
| --- | --- |
| Android phones/tablets | Expo / EAS Android build |
| iPhone and iPad | Expo / EAS iOS build |
| Windows, macOS, Linux | Responsive web app in a browser |
| Chrome, Edge, Firefox, Safari | Expo web export, subject to browser support |

This repository does not currently package native Windows or macOS desktop binaries. The web app is the computer experience. A dedicated desktop shell can be added later if there is a real need.

## Current capabilities

- NOVA Core chat through a configured OpenAI-compatible API.
- Core connection status without exposing credentials.
- Read-only market-data dashboard for EUR/USD, GBP/USD, and XAU/USD.
- Explicit unavailable states instead of invented prices or fake AI responses.
- Shared interface code for Android, iOS, and web.
- Backend-only secrets; no provider key belongs in the app bundle.

This is an advisory prototype. It does not browse the web, connect to broker accounts, place trades, or control physical machines.

## Architecture

- `App.tsx`: shared Expo / React Native interface.
- `backend/main.py`: FastAPI service for NOVA Core and market data.
- `backend/vercel.json`: Vercel FastAPI function configuration.
- `backend/tests/`: API contract tests.
- `eas.json`: EAS build profiles for Android and iOS.
- `.github/workflows/ci.yml`: TypeScript, web export, and backend test checks.
- `docs/research/`: point-in-time product, security, and market research notes.

## Research notes

- [LhamaBot public-information review](docs/research/lhamabot-public-review.md) — evidence review, unverified performance/withdrawal claims, age-term note, and product-safety lessons for NOVA.

## Requirements

- Node.js 20 or newer and npm.
- Python 3.11 or newer for backend development.
- Expo Go for quick device preview, or EAS Build for installable Android/iOS builds.
- A deployed HTTPS backend for real devices outside your local network.

## Configure environment variables

Set these on the backend host, not in the mobile app:

- `NOVA_AI_API_KEY`: private AI provider key.
- `NOVA_AI_BASE_URL`: optional OpenAI-compatible API base URL.
- `NOVA_AI_MODEL`: optional model name.
- `TWELVE_DATA_API_KEY`: private market-data provider key.

Set `EXPO_PUBLIC_NOVA_API_URL` in the Expo build environment to the HTTPS base URL of the deployed backend. This variable is public by design; never put a secret in it.

## Deploy the backend to Vercel

The Vercel project for this API is named `nova-api` and is linked to this GitHub repository. Its project root should be `backend/`, with the framework set to FastAPI. The `backend/vercel.json` file sets the function timeout.

Before deploying a public production API:

1. Add authentication and per-user authorization.
2. Add request throttling and abuse protection so public callers cannot consume the private AI provider quota.
3. Restrict CORS to the intended web origin.
4. Configure the private environment variables listed above in Vercel Project Settings → Environment Variables.
5. Deploy a preview first and verify `/health`, `/api/core/status`, and `/api/markets/status`.
6. Only after security checks, promote a tested deployment and set `EXPO_PUBLIC_NOVA_API_URL` to the API's HTTPS origin in Expo/EAS.

Never commit provider keys or paste them into source files, GitHub issues, or chat. Rotate any key that has been exposed.

## Run the app

```bash
npm install
npx expo start
```

- Press `a` to open Android (with Android tooling installed).
- Press `i` to open iOS Simulator (macOS with Xcode required).
- Press `w` to open the web app.

Or export a static web build:

```bash
npm run export:web
```

The web output is generated in `dist/` and can be deployed to a static host.

## Build installable mobile apps

Install and configure EAS CLI, then authenticate with your Expo account:

```bash
npx eas-cli login
npx eas-cli build --platform android --profile preview
npx eas-cli build --platform ios --profile preview
```

An Apple Developer account is required for normal iOS device distribution. EAS may prompt for signing credentials. Android preview builds use an installable APK profile; production Android builds use an app bundle.

## Run the backend locally

```bash
cd backend
python -m venv .venv
# Activate the environment, then:
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

For a physical phone, the phone must be able to reach the backend on the network, or use a deployed HTTPS URL. Do not use localhost as the backend URL on a physical phone.

## API endpoints

- `GET /health`
- `GET /api/core/status`
- `POST /api/core/chat`
- `GET /api/markets/status`
- `GET /api/markets`

## Security and production readiness

The API is not yet production-ready for unrestricted public use. Add authentication, per-user authorization, request throttling, abuse protection, secure secret rotation, monitoring, and audit logging before exposing paid AI features publicly. Restrict CORS to the deployed web origin where appropriate. Do not enable broker execution or machine control without a separately reviewed permission system, sandbox/testing environment, hard safety limits, and human approval.

## Roadmap

1. Secure backend deployment and API verification.
2. Cross-platform polish and EAS builds.
3. User accounts and secure, user-controlled persistent memory.
4. Research connectors with citations and source timestamps.
5. Shared planning/task engine and visible approval checkpoints.
6. Carefully isolated device integrations with safety interlocks and human supervision.
