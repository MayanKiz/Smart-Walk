import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { demoAlerts, demoContacts, demoDevice, demoLocation, demoUser } from "../lib/demoData";
import type { Contact, Device, LocationFix, SmartWalkUser, SosEvent } from "../lib/types";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

type AppContextValue = {
  demoMode: boolean;
  user: SmartWalkUser;
  device: Device;
  location: LocationFix | null;
  alerts: SosEvent[];
  contacts: Contact[];
  caregiverName: string;
  acknowledgeAlert: (id: string) => Promise<void>;
  resolveAlert: (id: string, note: string) => Promise<void>;
  addContact: (contact: Omit<Contact, "id">) => void;
  removeContact: (id: string) => void;
  refresh: () => Promise<void>;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState(demoUser);
  const [device, setDevice] = useState(demoDevice);
  const [location, setLocation] = useState<LocationFix | null>(demoLocation);
  const [alerts, setAlerts] = useState(demoAlerts);
  const [contacts, setContacts] = useState(demoContacts);

  const acknowledgeAlert = async (id: string) => {
    if (!isSupabaseConfigured) {
      setAlerts((current) =>
        current.map((alert) =>
          alert.id === id
            ? { ...alert, status: "acknowledged", acknowledgedBy: "You", acknowledgedAt: new Date().toISOString() }
            : alert,
        ),
      );
      return;
    }
    const { error } = await supabase!.rpc("acknowledge_sos", { event_id: id });
    if (error) throw error;
  };

  const resolveAlert = async (id: string, note: string) => {
    if (!isSupabaseConfigured) {
      setAlerts((current) =>
        current.map((alert) =>
          alert.id === id
            ? {
                ...alert,
                status: "resolved",
                acknowledgedBy: alert.acknowledgedBy ?? "You",
                acknowledgedAt: alert.acknowledgedAt ?? new Date().toISOString(),
                resolvedAt: new Date().toISOString(),
                resolutionNote: note,
              }
            : alert,
        ),
      );
      return;
    }
    const { error } = await supabase!.rpc("resolve_sos", { event_id: id, note });
    if (error) throw error;
  };

  const refresh = async () => {
    if (!isSupabaseConfigured || !supabase) return;
    const { data: access, error: accessError } = await supabase
      .from("caregiver_user_access")
      .select("smart_walk_user_id")
      .limit(1);
    if (accessError) throw accessError;
    const linkedUserId = access?.[0]?.smart_walk_user_id as string | undefined;
    if (!linkedUserId) {
      setUser({ id: "", displayName: "No user linked", relationship: "Setup required", notes: "Ask an admin for a pairing code.", preferredLanguage: "—" });
      setDevice({ id: "", identifier: "No device linked", battery: 0, online: false, gps: "unavailable", network: "—", lastSeenAt: new Date(0).toISOString(), firmware: "—" });
      setLocation(null);
      setAlerts([]);
      setContacts([]);
      return;
    }

    const [{ data: userRow, error: userError }, { data: deviceRow, error: deviceError }, { data: alertRows, error: alertError }, { data: contactRows, error: contactError }] = await Promise.all([
      supabase.from("smart_walk_users").select("*").eq("id", linkedUserId).single(),
      supabase.from("devices").select("*").eq("smart_walk_user_id", linkedUserId).limit(1).maybeSingle(),
      supabase.from("sos_events").select("*").eq("smart_walk_user_id", linkedUserId).order("triggered_at", { ascending: false }),
      supabase.from("emergency_contacts").select("*").eq("smart_walk_user_id", linkedUserId).order("priority"),
    ]);
    if (userError) throw userError;
    if (deviceError) throw deviceError;
    if (alertError) throw alertError;
    if (contactError) throw contactError;
    if (!userRow || !deviceRow) return;

    const { data: locationRow, error: locationError } = await supabase
      .from("locations")
      .select("*")
      .eq("device_id", deviceRow.id)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (locationError) throw locationError;

    setUser({ id: userRow.id, displayName: userRow.display_name, relationship: userRow.relationship ?? "Family", notes: userRow.notes ?? "No care notes added.", preferredLanguage: userRow.preferred_language ?? "Not set" });
    setDevice({ id: deviceRow.id, identifier: deviceRow.device_identifier, battery: deviceRow.battery_percent ?? 0, online: deviceRow.online_status, gps: deviceRow.gps_status, network: deviceRow.network_status ?? "Unknown", lastSeenAt: deviceRow.last_seen_at ?? new Date(0).toISOString(), firmware: deviceRow.firmware_version ?? "Unknown" });
    setLocation(locationRow ? { id: locationRow.id, latitude: locationRow.latitude, longitude: locationRow.longitude, accuracyM: locationRow.accuracy_m, recordedAt: locationRow.recorded_at } : null);
    setAlerts((alertRows ?? []).map((row) => ({ id: row.id, status: row.status, triggeredAt: row.triggered_at, location: null, acknowledgedBy: row.acknowledged_by ?? undefined, acknowledgedAt: row.acknowledged_at ?? undefined, resolvedAt: row.resolved_at ?? undefined, resolutionNote: row.resolution_note ?? undefined })));
    setContacts((contactRows ?? []).map((row) => ({ id: row.id, name: row.name, relationship: row.relationship ?? "Contact", phone: row.phone, priority: row.priority })));
  };

  useEffect(() => {
    if (isSupabaseConfigured) void refresh();
  }, []);

  useEffect(() => {
    const client = supabase;
    if (!isSupabaseConfigured || !client) return;
    const channel = client
      .channel("smart-walk-dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "devices" }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "locations" }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "sos_events" }, () => void refresh())
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      demoMode: !isSupabaseConfigured,
      user,
      device,
      location,
      alerts,
      contacts,
      caregiverName: "Maya Kiz",
      acknowledgeAlert,
      resolveAlert,
      addContact: (contact) => setContacts((current) => [...current, { ...contact, id: crypto.randomUUID() }]),
      removeContact: (id) => setContacts((current) => current.filter((contact) => contact.id !== id)),
      refresh,
    }),
    [alerts, contacts, device, location, user],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used inside AppProvider");
  return context;
}
