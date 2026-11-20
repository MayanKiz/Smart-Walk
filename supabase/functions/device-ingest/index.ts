import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type DevicePayload = {
  type: "heartbeat" | "location" | "sos";
  recorded_at?: string;
  latitude?: number;
  longitude?: number;
  accuracy_m?: number;
  battery_percent?: number;
  online_status?: boolean;
  gps_status?: "available" | "unavailable";
  network_status?: string;
  signal_strength?: number;
  firmware_version?: string;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "POST required" }, 405);

  const deviceIdentifier = request.headers.get("x-device-id");
  const deviceToken = request.headers.get("x-device-token");
  if (!deviceIdentifier || !deviceToken) {
    return json({ error: "Missing device credentials" }, 401);
  }

  let payload: DevicePayload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  if (!["heartbeat", "location", "sos"].includes(payload.type)) {
    return json({ error: "Invalid event type" }, 400);
  }
  if (
    payload.battery_percent !== undefined &&
    (!Number.isInteger(payload.battery_percent) ||
      payload.battery_percent < 0 ||
      payload.battery_percent > 100)
  ) {
    return json({ error: "Invalid battery percentage" }, 400);
  }
  if (payload.recorded_at && Number.isNaN(Date.parse(payload.recorded_at))) {
    return json({ error: "Invalid recorded_at timestamp" }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const tokenHash = await sha256(deviceToken);
  const { data: device, error: deviceError } = await supabase
    .from("devices")
    .select("id, smart_walk_user_id")
    .eq("device_identifier", deviceIdentifier)
    .eq("device_token_hash", tokenHash)
    .maybeSingle();

  if (deviceError || !device) return json({ error: "Invalid device credentials" }, 401);

  const recordedAt = payload.recorded_at ?? new Date().toISOString();
  const update = {
    online_status: payload.online_status ?? true,
    last_seen_at: recordedAt,
    ...(payload.battery_percent !== undefined
      ? { battery_percent: payload.battery_percent, last_battery_reported_at: recordedAt }
      : {}),
    ...(payload.gps_status ? { gps_status: payload.gps_status } : {}),
    ...(payload.network_status ? { network_status: payload.network_status } : {}),
    ...(payload.signal_strength !== undefined ? { signal_strength: payload.signal_strength } : {}),
    ...(payload.firmware_version ? { firmware_version: payload.firmware_version } : {}),
    ...(payload.gps_status === "available" ? { last_gps_fix_at: recordedAt } : {}),
  };
  const { error: updateError } = await supabase.from("devices").update(update).eq("id", device.id);
  if (updateError) return json({ error: "Could not update device" }, 500);

  let locationId: string | null = null;
  if (payload.type === "location" || payload.type === "sos") {
    if (
      typeof payload.latitude !== "number" ||
      typeof payload.longitude !== "number" ||
      payload.latitude < -90 ||
      payload.latitude > 90 ||
      payload.longitude < -180 ||
      payload.longitude > 180
    ) {
      return json({ error: "Invalid location coordinates" }, 400);
    }
    const { data: location, error: locationError } = await supabase
      .from("locations")
      .insert({
        device_id: device.id,
        latitude: payload.latitude,
        longitude: payload.longitude,
        accuracy_m: payload.accuracy_m ?? null,
        recorded_at: recordedAt,
      })
      .select("id")
      .single();
    if (locationError) return json({ error: "Could not save location" }, 500);
    locationId = location.id;
  }

  if (payload.type === "sos") {
    const { data: event, error: sosError } = await supabase
      .from("sos_events")
      .insert({
        smart_walk_user_id: device.smart_walk_user_id,
        device_id: device.id,
        location_id: locationId,
        triggered_at: recordedAt,
      })
      .select("id, triggered_at, status")
      .single();
    if (sosError) return json({ error: "Could not save SOS event" }, 500);
    return json({ ok: true, event });
  }

  return json({ ok: true, location_id: locationId });
});
