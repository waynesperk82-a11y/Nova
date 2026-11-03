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
- `backend/tests/`: API contract tests.
- `eas.json`: EAS build profiles for Android and iOS.
- `.github/workflows/ci.yml`: TypeScript, web export, and backend test checks.
- `render.yaml`: optional Render backend deployment blueprint.

## Requirements

- Node.js 20 or newer and npm.
- Python 3.11 or newer for backend development.
- Expo Go for quick device preview, or EAS Build for installable Android/iOS builds.
- A deployed HTTPS backend for real devices outside your local network.

## Configure environment variables

Copy `.env.example` as a reference. Set these on the backend host, not in the mobile app:

- `NOVA_AI_API_KEY`: private AI provider key.
- `NOVA_AI_BASE_URL`: optional OpenAI-compatible API base URL.
- `NOVA_AI_MODEL`: optional model name.
- `TWELVE_DATA_API_KEY`: private market-data provider key.

Set `EXPO_PUBLIC_NOVA_API_URL` in the Expo build environment to the HTTPS base URL of the deployed backend. This variable is public by design; never put a secret in it.

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
- `GET /api/markets`

## Security and production readiness

Before making the service public, add user authentication, per-user authorization, request throttling, abuse protection, secure secret rotation, monitoring, and audit logging. Restrict CORS to the deployed web origin where appropriate. Do not enable broker execution or machine control without a separately reviewed permission system, sandbox/testing environment, hard safety limits, and human approval.

## Roadmap

1. Cross-platform polish and CI (this upgrade).
2. User accounts and secure, user-controlled persistent memory.
3. Research connectors with citations and source timestamps.
4. Shared planning/task engine and visible approval checkpoints.
5. Broker integrations with demo testing and explicit approvals.
6. Carefully isolated industrial/device integrations with safety interlocks and human supervision.
