# NOVA Supabase device storage setup

NOVA uses local-first storage with optional Supabase cloud sync. There is no email/password sign-up screen.

## Architecture

- The app keeps a local snapshot on the device using the Expo SQLite localStorage adapter.
- Supabase Auth creates a silent anonymous identity for the installation.
- The `device_snapshots` table stores the app snapshot under that identity.
- Row Level Security checks both `auth.uid()` and the JWT `is_anonymous` claim.
- If Supabase is unavailable or not configured, NOVA can continue using local storage.

Anonymous Auth still creates an Auth user record behind the scenes. It is not a registered account and asks the user for no email or password. If app data is cleared or the app is reinstalled, the anonymous identity may be lost and its cloud snapshot may no longer be recoverable.

## Supabase dashboard steps

1. Open Authentication settings for the NOVA Supabase project.
2. Enable Anonymous Sign-Ins.
3. Open the SQL Editor.
4. Run the contents of `supabase/migrations/202611140001_device_snapshots.sql`.
5. Confirm the `device_snapshots` table exists and RLS is enabled.

## App environment variables

Set these on the Vercel project that builds the NOVA frontend, for Production, Preview, and Development:

- `EXPO_PUBLIC_SUPABASE_URL` = the Supabase project URL.
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = the Supabase publishable key.

Only the publishable key belongs in frontend configuration. Never expose a Supabase secret or service-role key in the app.

## Implementation status

The client and snapshot-sync helpers are foundational modules. The app UI still needs to hydrate and persist its chat, watchlist, and workspace state through these helpers, then be tested in web and Android builds before cloud sync can be called complete.
