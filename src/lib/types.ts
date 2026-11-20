export type Status = "new" | "acknowledged" | "resolved";

export type SmartWalkUser = {
  id: string;
  displayName: string;
  relationship: string;
  notes: string;
  preferredLanguage: string;
};

export type Device = {
  id: string;
  identifier: string;
  battery: number;
  online: boolean;
  gps: "available" | "unavailable";
  network: string;
  lastSeenAt: string;
  firmware: string;
};

export type LocationFix = {
  id: string;
  latitude: number;
  longitude: number;
  accuracyM: number | null;
  recordedAt: string;
};

export type SosEvent = {
  id: string;
  status: Status;
  triggeredAt: string;
  location: LocationFix | null;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  resolutionNote?: string;
};

export type Contact = {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  priority: number;
};
