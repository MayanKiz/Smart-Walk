# Smart Walk

Smart Walk is a caregiver-facing safety dashboard for SOS visibility, GPS freshness,
family access and device health. The hardware/device firmware is intentionally outside
this repository; the admin panel and secure ingestion boundary are included.

## Web app

The frontend is React + TypeScript + Vite. With no Vite Supabase variables present it
runs in a clearly labelled **Demo data** mode so the complete dashboard can be reviewed
without exposing or inventing production telemetry.

```bash
npm install
npm run dev
```

For a connected project, copy `.env.example` to `.env.local` and set:

```text
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
```

Only the public anon key belongs in the browser. The service role key is used only by
the device Edge Function.

## Google authentication

In Supabase Dashboard:

1. Open **Authentication → Providers → Google** and enable it.
2. Create OAuth credentials in Google Cloud.
3. Set Supabase's callback URL as an authorised redirect URI in Google Cloud.
4. Add `https://zhcvpicbyqahtrkxpftl.supabase.co/auth/v1/callback` to Google authorised redirect URIs.
5. Add the Google client ID and secret to Supabase.
6. In **Authentication → URL Configuration**, add the deployed web app origin to
   Redirect URLs.

## Apply database migrations

In Supabase Dashboard open **SQL Editor** and run both migration files in filename
order:

```text
supabase/migrations/20261120172500_initial_schema.sql
supabase/migrations/20261120174500_pairing_codes.sql
```

Then deploy the Edge Function in Supabase Dashboard or with an authenticated Supabase CLI:

```bash
npx supabase link --project-ref zhcvpicbyqahtrkxpftl
npx supabase functions deploy device-ingest --no-verify-jwt
```

Included screens:

- Landing, caregiver login, account onboarding and help
- Overview dashboard with SOS priority state, device health and location preview
- Live tracking with GPS freshness and last-known-location labels
- SOS history with acknowledgement and resolution workflow
- User details, device health, emergency contacts and settings
- Admin panel for the operator's device pairing checklist

This repository contains the Supabase backend foundation for the Smart Walk caregiver
dashboard.

## Architecture

The device sends signed requests to the `device-ingest` Edge Function. The function
validates the device identifier/token, stores telemetry, creates SOS events, and updates
device health. The caregiver web app uses Supabase Auth, Postgres RLS, and Realtime.

The browser must only receive the public Supabase URL and anon key. Never expose
`SUPABASE_SERVICE_ROLE_KEY` in frontend code.

## Local setup

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
npx supabase functions deploy device-ingest --no-verify-jwt
```

`device-ingest` uses device credentials instead of a caregiver JWT. Store each device
token only as a SHA-256 hash in `devices.device_token_hash`; issue tokens through a
trusted provisioning process.

## Device request

`POST /functions/v1/device-ingest`

Headers:

```text
x-device-id: SW-0001
x-device-token: <provisioned-secret>
content-type: application/json
```

Heartbeat:

```json
{
  "type": "heartbeat",
  "battery_percent": 82,
  "gps_status": "available",
  "network_status": "lte"
}
```

Location and SOS payloads require `latitude` and `longitude`. The dashboard should
label a location as **Last known location** whenever its timestamp is outside the
chosen freshness threshold; a device being online does not mean the person is safe.

Caregiver actions use the RPCs `acknowledge_sos(event_id)` and
`resolve_sos(event_id, resolution_note)`. Resolution requires a note and both actions
are written to `audit_logs`.
