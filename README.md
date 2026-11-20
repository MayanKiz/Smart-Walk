# Smart Walk backend

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
