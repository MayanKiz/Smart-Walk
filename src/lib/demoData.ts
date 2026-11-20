import type { Contact, Device, LocationFix, SmartWalkUser, SosEvent } from "./types";

export const demoUser: SmartWalkUser = {
  id: "demo-user-1",
  displayName: "Aarav Sharma",
  relationship: "Son",
  notes: "Prefers Hindi. Carrying the device on afternoon walks.",
  preferredLanguage: "Hindi",
};

export const demoDevice: Device = {
  id: "demo-device-1",
  identifier: "SW-DEMO-001",
  battery: 78,
  online: true,
  gps: "available",
  network: "LTE",
  lastSeenAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
  firmware: "0.9.4",
};

export const demoLocation: LocationFix = {
  id: "demo-location-1",
  latitude: 28.6139,
  longitude: 77.209,
  accuracyM: 18,
  recordedAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
};

export const demoAlerts: SosEvent[] = [
  {
    id: "demo-alert-1",
    status: "acknowledged",
    triggeredAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    location: demoLocation,
    acknowledgedBy: "You",
    acknowledgedAt: new Date(Date.now() - 42 * 60 * 1000).toISOString(),
  },
  {
    id: "demo-alert-2",
    status: "resolved",
    triggeredAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    location: null,
    acknowledgedBy: "You",
    acknowledgedAt: new Date(Date.now() - 3 * 86400000 + 4 * 60000).toISOString(),
    resolvedAt: new Date(Date.now() - 3 * 86400000 + 15 * 60000).toISOString(),
    resolutionNote: "Checked in by phone; safe at home.",
  },
];

export const demoContacts: Contact[] = [
  { id: "contact-1", name: "Priya Sharma", relationship: "Mother", phone: "+91 98765 43210", priority: 1 },
  { id: "contact-2", name: "Rahul Sharma", relationship: "Uncle", phone: "+91 99887 66554", priority: 2 },
];
