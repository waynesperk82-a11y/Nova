# NOVA Trader AI

NOVA is an Android-first market research and trading-education app focused on forex and gold.

## Current scope
- Expo / React Native Android application
- Forex watchlist: EUR/USD and GBP/USD
- Gold watchlist: XAU/USD
- Market overview and portfolio UI
- Clearly labelled paper-trading workspace for development and strategy evaluation

## Safety and scope
This repository is for market research, education and simulated trading. It does not connect to a broker, accept broker credentials, or submit live orders. Simulated prices and results must never be presented as real market data or real profits.

## Run locally
```bash
npm install
npx expo start
```
Install Expo Go on Android and scan the QR code shown by Expo.

## Next milestones
1. Build the Android UI and navigation.
2. Add a properly sourced read-only market-data feed with timestamps and stale-data handling.
3. Add historical strategy evaluation and paper-trading records.
4. Add tests, risk explanations and performance reporting.
