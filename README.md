# NOVA Market AI

Android-first, read-only market information dashboard for EUR/USD, GBP/USD, and XAU/USD.

## No simulated content
- No virtual balance, paper positions, sample prices, or simulated profit/loss.
- NOVA displays only values returned by the configured market-data provider.
- If a quote is missing or the connection fails, the app displays an unavailable state instead of inventing a value.
- This project does not connect to broker accounts or submit buy/sell orders.

## Architecture
- `App.tsx`: Expo / React Native Android interface.
- `backend/main.py`: small FastAPI service that requests quotes from Twelve Data.
- The provider key stays on the backend as `TWELVE_DATA_API_KEY`; never add it to the mobile app or commit it to GitHub.
- The app reads the backend URL from `EXPO_PUBLIC_NOVA_API_URL`.

## Configure the read-only data connection
1. Deploy the `backend` folder to a Python host.
2. Set `TWELVE_DATA_API_KEY` as a private environment variable on that backend host. Do not paste it into chat, source code, or a public repository.
3. Set `EXPO_PUBLIC_NOVA_API_URL` in the Expo build environment to the backend's HTTPS base URL.
4. Rebuild/restart the Expo app and tap **Refresh real market data**.

A provider account and plan may have eligibility, symbol-coverage, latency, and request-limit conditions. A successful API response does not by itself guarantee an exchange-real-time feed; the provider's timestamp and entitlement determine the data's freshness.

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
Set `EXPO_PUBLIC_NOVA_API_URL` to your backend address in the Expo environment, then:
```bash
npx expo start
```

## API
- `GET /health`: reports whether a provider key is configured; it never returns the key.
- `GET /api/markets`: returns provider-supplied quotes or an explicit error.

The API is read-only. It intentionally has no broker credentials, order endpoints, or trade execution code.
