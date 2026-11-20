import { createContext, useContext, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  BatteryCharging,
  Bell,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Contact,
  HeartPulse,
  Home,
  LogOut,
  MapPin,
  Menu,
  MoreHorizontal,
  Navigation,
  Phone,
  Plus,
  Radio,
  RefreshCw,
  Save,
  Settings,
  Shield,
  Smartphone,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { MapContainer, Marker, Popup, TileLayer, Circle as MapCircle } from "react-leaflet";
import { Link, NavLink, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AppProvider, useApp } from "./context/AppContext";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import type { Contact as EmergencyContact, SosEvent, Status } from "./lib/types";

type IconType = typeof Home;

const navItems: { label: string; to: string; icon: IconType }[] = [
  { label: "Overview", to: "/app", icon: Home },
  { label: "Live Tracking", to: "/app/tracking", icon: Navigation },
  { label: "SOS Alerts", to: "/app/alerts", icon: AlertTriangle },
  { label: "User Details", to: "/app/user", icon: UserRound },
  { label: "Device Health", to: "/app/device", icon: HeartPulse },
  { label: "Emergency Contacts", to: "/app/contacts", icon: Contact },
  { label: "Settings", to: "/app/settings", icon: Settings },
];

function App() {
  return (
    <AppProvider>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/help" element={<HelpPage />} />
          <Route path="/app" element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="tracking" element={<Tracking />} />
            <Route path="alerts" element={<Alerts />} />
            <Route path="user" element={<UserDetails />} />
            <Route path="device" element={<DeviceHealth />} />
            <Route path="contacts" element={<Contacts />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="admin" element={<AdminPanel />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </AppProvider>
  );
}

type AuthValue = {
  authenticated: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

function AuthProvider({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setAuthenticated(Boolean(data.session));
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setAuthenticated(Boolean(session)));
    return () => data.subscription.unsubscribe();
  }, []);

  const value: AuthValue = {
    authenticated,
    loading,
    signIn: async (email, password) => {
      if (!supabase) throw new Error("Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    signUp: async (name, email, password) => {
      if (!supabase) throw new Error("Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
      const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } });
      if (error) throw error;
    },
    signInWithGoogle: async () => {
      if (!supabase) throw new Error("Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/app` },
      });
      if (error) throw error;
    },
    signOut: async () => {
      if (supabase) await supabase.auth.signOut();
      localStorage.removeItem("smartwalk-demo-auth");
      setAuthenticated(false);
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const auth = useAuth();
  if (auth.loading) return <LoadingScreen />;
  return auth.authenticated ? children : <Navigate to="/login" replace />;
}

function Landing() {
  return (
    <div className="public-page">
      <PublicHeader />
      <main>
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow"><Shield size={15} /> Family safety support</div>
            <h1>Stay connected<br /><span>when it matters.</span></h1>
            <p>Smart Walk helps trusted family members view location updates, receive SOS alerts and check device health in one calm, dependable dashboard.</p>
            <div className="hero-actions">
              <Link className="button button-primary" to="/onboarding">Get started <ChevronRight size={17} /></Link>
              <Link className="button button-ghost" to="/login">Caregiver login</Link>
            </div>
            <div className="trust-row"><Check size={16} /> Privacy-first access <Check size={16} /> Clear GPS timestamps <Check size={16} /> Built for caregivers</div>
          </div>
          <div className="hero-visual">
            <div className="dashboard-preview">
              <div className="preview-top"><span className="brand-mark small">S</span><strong>Overview</strong><span className="status-dot online" /></div>
              <div className="preview-alert"><AlertTriangle size={18} /><div><strong>No active SOS alerts</strong><span>Everything is quiet right now</span></div><Check size={18} /></div>
              <div className="preview-stats"><MiniStat icon={<Radio />} label="Device" value="Online" tone="teal" /><MiniStat icon={<BatteryCharging />} label="Battery" value="78%" tone="blue" /><MiniStat icon={<MapPin />} label="GPS" value="Available" tone="navy" /></div>
              <div className="preview-map"><span className="map-road road-one" /><span className="map-road road-two" /><span className="preview-pin"><MapPin size={24} /></span><span className="map-label">Last known location</span></div>
            </div>
          </div>
        </section>
        <section className="section centered">
          <div className="eyebrow">How it works</div><h2>One clear view for the people who care.</h2><p className="section-intro">The physical device sends events to the cloud. Caregivers get a secure, timestamped view—without false promises about safety or coverage.</p>
          <div className="steps"><Step number="01" title="Smart Walk user carries the device" text="The device reports GPS, battery and connectivity when available." /><Step number="02" title="SOS is triggered when help is needed" text="The event is recorded and appears prominently for caregivers." /><Step number="03" title="A caregiver checks and responds" text="Acknowledge, contact family or local support, then resolve with a note." /></div>
        </section>
        <section className="section feature-section"><div><div className="eyebrow">Designed for calm confidence</div><h2>Urgent information first. Routine information easy to understand.</h2></div><div className="feature-grid"><Feature icon={<AlertTriangle />} title="SOS alerts" text="See new, acknowledged and resolved events with an audit trail." /><Feature icon={<MapPin />} title="GPS location" text="Freshness is always visible. Stale data is never presented as live." /><Feature icon={<HeartPulse />} title="Device health" text="Battery, connectivity and GPS state in one glance." /><Feature icon={<Users />} title="Family access" text="Only authorised caregivers can view linked people and locations." /></div></section>
      </main>
      <PublicFooter />
    </div>
  );
}

function PublicHeader() {
  return <header className="public-header"><Link to="/" className="brand"><span className="brand-mark">S</span><span>Smart Walk</span></Link><nav><a href="#how-it-works">How it works</a><a href="#safety">Safety</a><Link to="/help">Contact</Link><Link className="button button-small button-outline" to="/login">Login</Link></nav></header>;
}

function PublicFooter() {
  return <footer className="public-footer"><div className="brand"><span className="brand-mark small">S</span><span>Smart Walk</span></div><span>Privacy-first access · Emergency-use support tool · Not a replacement for local emergency services</span></footer>;
}

function Login() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(""); setBusy(true);
    try { await auth.signIn(email, password); navigate("/app"); } catch (err) { setError(err instanceof Error ? err.message : "Could not sign in."); } finally { setBusy(false); }
  };
  const googleSignIn = async () => {
    setError("");
    try { await auth.signInWithGoogle(); } catch (err) {
      setError(authErrorMessage(err, "Google sign-in could not start."));
    }
  };
  return <div className="auth-page"><div className="auth-art"><Link to="/" className="brand light"><span className="brand-mark">S</span><span>Smart Walk</span></Link><div><div className="eyebrow light-eyebrow"><Shield size={15} /> Trusted caregiver access</div><h1>Your family connection,<br /><span>in one place.</span></h1><p>Sign in to check location freshness, device status and emergency alerts for the people you care about.</p></div><span className="auth-disclaimer">Only authorised caregivers can access linked user and location information.</span></div><div className="auth-form-wrap"><Link to="/" className="mobile-brand brand"><span className="brand-mark">S</span><span>Smart Walk</span></Link><div className="auth-form"><div className="eyebrow">Welcome back</div><h2>Caregiver login</h2><p className="muted">Use your account to continue to the dashboard.</p>{error && <div className="error-box"><AlertTriangle size={16} /> {error}</div>}<button className="google-button" type="button" onClick={googleSignIn}><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.6h3.2c1.9-1.7 3-4.3 3-7.4z"/><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4L15.4 17c-.9.6-2.1 1-3.4 1-2.6 0-4.9-1.8-5.7-4.2H3v2.7A10 10 0 0 0 12 22z"/><path fill="#FBBC05" d="M6.3 13.8A6 6 0 0 1 6 12c0-.6.1-1.2.3-1.8V7.5H3A10 10 0 0 0 2 12c0 1.6.4 3.2 1 4.5l3.3-2.7z"/><path fill="#EA4335" d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.8A10 10 0 0 0 3 7.5l3.3 2.7C7.1 7.8 9.4 6 12 6z"/></svg> Continue with Google</button><div className="auth-divider"><span>or continue with email</span></div><form onSubmit={submit}><label>Email address<input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required /></label><label>Password<input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" required /></label><div className="form-row"><label className="check-label"><input type="checkbox" /> Remember me</label><a href="#forgot">Forgot password?</a></div><button className="button button-primary button-full" disabled={busy}>{busy ? "Signing in..." : "Sign in"} <ChevronRight size={17} /></button></form><p className="auth-switch">New caregiver? <Link to="/onboarding">Create an account</Link></p>{!isSupabaseConfigured && <div className="demo-note"><span className="demo-dot" /> Backend setup required: Supabase URL and anon key are missing.</div>}</div></div></div>;
}

function Onboarding() {
  const auth = useAuth(); const navigate = useNavigate();
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [code, setCode] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => { event.preventDefault(); setError(""); setBusy(true); try { await auth.signUp(name, email, password); if (code.trim() && supabase) { const { error: pairError } = await supabase.rpc("consume_pairing_code", { code_value: code.trim() }); if (pairError) throw pairError; } navigate("/app"); } catch (err) { setError(authErrorMessage(err, "Could not create account.")); } finally { setBusy(false); } };
  return <div className="auth-page onboarding-page"><div className="auth-form-wrap centered-form"><Link to="/" className="brand"><span className="brand-mark">S</span><span>Smart Walk</span></Link><div className="auth-form"><div className="eyebrow">Start safely</div><h2>Create caregiver account</h2><p className="muted">Only collect what you need to get started. You can link a user or device after signup.</p>{error && <div className="error-box"><AlertTriangle size={16} /> {error}</div>}<button type="button" className="google-button" onClick={() => auth.signInWithGoogle().catch((err) => setError(authErrorMessage(err, "Google sign-in could not start.")))}><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.6h3.2c1.9-1.7 3-4.3 3-7.4z"/><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4L15.4 17c-.9.6-2.1 1-3.4 1-2.6 0-4.9-1.8-5.7-4.2H3v2.7A10 10 0 0 0 12 22z"/><path fill="#FBBC05" d="M6.3 13.8A6 6 0 0 1 6 12c0-.6.1-1.2.3-1.8V7.5H3A10 10 0 0 0 2 12c0 1.6.4 3.2 1 4.5l3.3-2.7z"/><path fill="#EA4335" d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.8A10 10 0 0 0 3 7.5l3.3 2.7C7.1 7.8 9.4 6 12 6z"/></svg> Continue with Google</button><div className="auth-divider"><span>or create with email</span></div><form onSubmit={submit}><label>Full name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" required /></label><label>Email address<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required /></label><label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" minLength={8} required /></label><label>Pairing code <span className="optional">optional</span><input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ask your project admin for a code" /></label><label className="check-label"><input type="checkbox" required /> I agree to the privacy terms and understand this is not a replacement for emergency services.</label><button className="button button-primary button-full" disabled={busy}>{busy ? "Creating account..." : "Create account"} <ChevronRight size={17} /></button></form><p className="auth-switch">Already registered? <Link to="/login">Sign in</Link></p></div></div></div>;
}

function HelpPage() {
  return <div className="public-page"><PublicHeader /><main className="simple-page"><div className="eyebrow">Contact & help</div><h1>Need a hand?</h1><p>For account access, device pairing or dashboard support, contact your Smart Walk project operator. In an emergency, contact the person directly and your local emergency services.</p><div className="help-cards"><div className="card"><CircleHelp /><h3>Device pairing</h3><p>Ask an admin for a one-time pairing code. Hardware setup is managed separately from this web dashboard.</p></div><div className="card"><Phone /><h3>Emergency use</h3><p>Smart Walk supports family notification. It does not guarantee delivery, continuous tracking or rescue.</p></div></div></main><PublicFooter /></div>;
}

function AppShell() {
  const auth = useAuth(); const app = useApp(); const location = useLocation(); const [mobileOpen, setMobileOpen] = useState(false);
  const title = navItems.find((item) => item.to === location.pathname)?.label ?? (location.pathname.includes("admin") ? "Admin panel" : "Overview");
  return <div className="app-shell"><aside className={`sidebar ${mobileOpen ? "open" : ""}`}><div className="sidebar-head"><Link to="/app" className="brand light"><span className="brand-mark">S</span><span>Smart Walk</span></Link><button className="icon-button mobile-close" onClick={() => setMobileOpen(false)}><X size={20} /></button></div><div className="demo-banner"><span className="demo-dot" /> {app.demoMode ? "Demo data" : "Connected to Supabase"}</div><nav className="side-nav">{navItems.map(({ label, to, icon: Icon }) => <NavLink key={to} to={to} end={to === "/app"} onClick={() => setMobileOpen(false)} className={({ isActive }) => isActive ? "active" : ""}><Icon size={18} /><span>{label}</span>{label === "SOS Alerts" && app.alerts.some((alert) => alert.status === "new") && <span className="nav-count">!</span>}</NavLink>)}<NavLink to="/app/admin" onClick={() => setMobileOpen(false)} className={({ isActive }) => isActive ? "active admin-link" : "admin-link"}><Shield size={18} /><span>Admin panel</span></NavLink></nav><div className="sidebar-bottom"><div className="sidebar-help"><CircleHelp size={17} /><div><strong>Need help?</strong><Link to="/help">Visit support</Link></div></div><button className="side-logout" onClick={() => auth.signOut()}><LogOut size={17} /> Sign out</button></div></aside>{mobileOpen && <button className="sidebar-backdrop" onClick={() => setMobileOpen(false)} aria-label="Close navigation" /> }<div className="main-area"><header className="topbar"><button className="icon-button menu-button" onClick={() => setMobileOpen(true)}><Menu size={22} /></button><div><span className="topbar-kicker">Caregiver dashboard</span><h1>{title}</h1></div><div className="topbar-actions"><button className="icon-button notification-button" aria-label="Notifications"><Bell size={19} />{app.alerts.some((alert) => alert.status === "new") && <span />}</button><div className="profile-menu"><span className="avatar">MK</span><div className="profile-name"><strong>{app.caregiverName}</strong><span>Caregiver</span></div><MoreHorizontal size={18} /></div></div></header><main className="content"><Outlet /></main></div></div>;
}

function Dashboard() {
  const app = useApp(); const activeAlert = app.alerts.find((alert) => alert.status === "new"); const fresh = app.location && isFresh(app.location.recordedAt);
  return <div className="page-stack"><div className="welcome-row"><div><p className="eyebrow">Thursday, 20 November 2026</p><h2>Good evening, Maya</h2><p className="muted">Here is the latest update for your linked Smart Walk user.</p></div><Link to="/app/tracking" className="button button-outline"><RefreshCw size={16} /> Refresh data</Link></div>{activeAlert ? <AlertBanner alert={activeAlert} /> : <div className="quiet-banner"><div className="quiet-icon"><Check size={19} /></div><div><strong>No active SOS alerts</strong><span>Everything is quiet right now. You will see urgent events here first.</span></div><Link to="/app/alerts">View alert history <ChevronRight size={15} /></Link></div>}<div className="section-heading"><div><h3>Current status</h3><span className="muted">Linked user · {app.user.displayName}</span></div><Link to="/app/user" className="text-link">View user details <ChevronRight size={15} /></Link></div><div className="stat-grid"><StatusCard icon={<Radio />} label="Device status" value={app.device.online ? "Online" : "Offline"} detail={`Last seen ${relativeTime(app.device.lastSeenAt)}`} tone="teal" /><StatusCard icon={<BatteryCharging />} label="Battery" value={`${app.device.battery}%`} detail={app.device.battery < 20 ? "Battery is low" : "Healthy level"} tone={app.device.battery < 20 ? "red" : "blue"} /><StatusCard icon={<MapPin />} label="GPS status" value={app.device.gps === "available" ? "Available" : "Unavailable"} detail={fresh ? `Updated ${relativeTime(app.location!.recordedAt)}` : "Last known location"} tone="navy" /><StatusCard icon={<Clock3 />} label="Last activity" value={relativeTime(app.device.lastSeenAt)} detail="Device communication" tone="purple" /></div><div className="dashboard-grid"><div className="card map-card"><div className="card-head"><div><h3>Location snapshot</h3><span className="muted">{fresh ? "Live location" : "Last known location"} · {app.location ? formatDate(app.location.recordedAt) : "No fix available"}</span></div><Link to="/app/tracking" className="icon-link"><Navigation size={17} /></Link></div><LocationMap compact /></div><div className="card activity-card"><div className="card-head"><div><h3>Recent activity</h3><span className="muted">Latest device and safety events</span></div><Link to="/app/alerts" className="text-link">See all</Link></div><ActivityItem icon={<Radio />} title="Device checked in" detail={`Battery ${app.device.battery}% · ${app.device.network}`} time={relativeTime(app.device.lastSeenAt)} tone="teal" /><ActivityItem icon={<MapPin />} title={app.location ? "GPS location received" : "No GPS fix"} detail={app.location ? `${app.location.accuracyM}m accuracy` : "Location unavailable"} time={app.location ? relativeTime(app.location.recordedAt) : "—"} tone="blue" />{app.alerts[0] && <ActivityItem icon={<AlertTriangle />} title={`SOS ${statusLabel(app.alerts[0].status).toLowerCase()}`} detail="Alert history" time={relativeTime(app.alerts[0].triggeredAt)} tone="red" />}</div></div></div>;
}

function Tracking() {
  const app = useApp(); const fresh = app.location && isFresh(app.location.recordedAt);
  return <div className="page-stack"><PageIntro eyebrow="Location awareness" title="Live tracking" text="Make freshness and uncertainty impossible to miss. Online does not mean safe." action={<button className="button button-outline"><RefreshCw size={16} /> Refresh</button>} /><div className="tracking-layout"><div className="card map-card large-map"><div className="map-toolbar"><div className="select-like"><UserRound size={15} /> {app.user.displayName}<ChevronRight size={15} /></div><div className="toolbar-actions"><button className="button button-ghost button-small">Map</button><button className="button button-ghost button-small">Satellite</button></div></div><LocationMap /></div><div className="tracking-side"><div className={`status-callout ${fresh ? "success-callout" : "warning-callout"}`}><div className="callout-icon">{fresh ? <Check size={18} /> : <Clock3 size={18} />}</div><div><strong>{fresh ? "Live location" : "Last known location"}</strong><span>{app.location ? `Updated ${formatDate(app.location.recordedAt)} (${relativeTime(app.location.recordedAt)})` : "Location unavailable"}</span></div></div><div className="card details-card"><h3>Location details</h3><DetailRow label="Address" value={app.location ? "New Delhi, India" : "Location unavailable"} /><DetailRow label="Coordinates" value={app.location ? `${app.location.latitude.toFixed(5)}, ${app.location.longitude.toFixed(5)}` : "—"} /><DetailRow label="GPS accuracy" value={app.location?.accuracyM ? `${app.location.accuracyM}m` : "Not supplied"} /><DetailRow label="Location source" value={app.location ? "Smart Walk device" : "—"} /></div><div className="card details-card"><h3>Connection</h3><DetailRow label="Device" value={app.device.online ? "Online" : "Offline"} indicator={app.device.online ? "teal" : "red"} /><DetailRow label="GPS" value={app.device.gps === "available" ? "Available" : "Unavailable"} indicator={app.device.gps === "available" ? "teal" : "amber"} /><DetailRow label="Last seen" value={relativeTime(app.device.lastSeenAt)} /></div></div></div></div>;
}

function Alerts() {
  const app = useApp(); const [filter, setFilter] = useState<"all" | Status>("all"); const [selected, setSelected] = useState<SosEvent | null>(null);
  const list = filter === "all" ? app.alerts : app.alerts.filter((alert) => alert.status === filter);
  return <div className="page-stack"><PageIntro eyebrow="Safety history" title="SOS alerts" text="Review emergency events, acknowledge attention and record resolution separately." action={<button className="button button-outline"><RefreshCw size={16} /> Refresh</button>} /><div className="alert-summary-grid"><SummaryPill label="Active" value={app.alerts.filter((a) => a.status === "new").length} tone="red" /><SummaryPill label="Acknowledged" value={app.alerts.filter((a) => a.status === "acknowledged").length} tone="amber" /><SummaryPill label="Resolved" value={app.alerts.filter((a) => a.status === "resolved").length} tone="teal" /></div><div className="card table-card"><div className="filter-row"><div className="filter-tabs">{(["all", "new", "acknowledged", "resolved"] as const).map((item) => <button key={item} className={filter === item ? "selected" : ""} onClick={() => setFilter(item)}>{item === "all" ? "All alerts" : statusLabel(item)}</button>)}</div><button className="button button-ghost button-small"><Clock3 size={15} /> Date range</button></div>{list.length ? <div className="alert-list">{list.map((alert) => <AlertRow key={alert.id} alert={alert} onOpen={() => setSelected(alert)} />)}</div> : <EmptyState icon={<Check />} title="No alerts in this view" text="There are no SOS events matching the selected filter." />}</div>{selected && <AlertDrawer alert={selected} onClose={() => setSelected(null)} />}</div>;
}

function UserDetails() {
  const app = useApp(); return <div className="page-stack"><PageIntro eyebrow="Linked profile" title="User details" text="Keep only the information your family chooses to store and has permission to share." action={<button className="button button-outline"><Save size={16} /> Save changes</button>} /><div className="profile-layout"><div className="card profile-card"><div className="profile-hero"><div className="user-avatar">AS</div><div><h2>{app.user.displayName}</h2><span className="muted">{app.user.relationship} · Linked Smart Walk user</span></div><span className="status-chip teal"><Check size={14} /> Linked</span></div><div className="form-grid"><ReadOnly label="Full name" value={app.user.displayName} /><ReadOnly label="Relationship" value={app.user.relationship} /><ReadOnly label="Preferred language" value={app.user.preferredLanguage} /><ReadOnly label="Age range" value="Not added" /></div><div className="notes-box"><label>Care notes</label><p>{app.user.notes}</p></div></div><div className="card side-card"><h3>Linked device</h3><div className="device-mini"><div className="device-icon"><Smartphone size={20} /></div><div><strong>{app.device.identifier}</strong><span>{app.device.online ? "Online" : "Offline"} · firmware {app.device.firmware}</span></div></div><Link to="/app/device" className="button button-ghost button-full">Manage device <ChevronRight size={16} /></Link><div className="privacy-note"><Shield size={17} /><span>Only authorised linked caregivers can view this profile.</span></div></div></div></div>;
}

function DeviceHealth() {
  const app = useApp(); return <div className="page-stack"><PageIntro eyebrow="Hardware confidence" title="Device health" text="See whether the hardware is communicating and whether the caregiver should take action." action={<button className="button button-outline"><RefreshCw size={16} /> Refresh</button>} /><div className="device-health-grid"><div className="card health-hero"><div className="health-hero-top"><div className="device-icon large"><Smartphone size={26} /></div><div><span className="muted">Device identifier</span><h2>{app.device.identifier}</h2><span className="status-chip teal"><span className="chip-dot" /> Online</span></div></div><div className="health-big-status"><div className="big-battery"><BatteryCharging size={23} /><strong>{app.device.battery}%</strong></div><div><strong>Healthy battery level</strong><span>Last battery report {relativeTime(app.device.lastSeenAt)}</span></div></div></div><div className="card health-list"><h3>Device status</h3><DetailRow label="Network" value={app.device.network} indicator="teal" /><DetailRow label="Last communication" value={formatDate(app.device.lastSeenAt)} /><DetailRow label="GPS fix" value={app.device.gps === "available" ? "Available" : "Unavailable"} indicator={app.device.gps === "available" ? "teal" : "amber"} /><DetailRow label="Firmware" value={app.device.firmware} /></div></div><div className="info-banner"><CircleHelp size={18} /><div><strong>When should I take action?</strong><p>If the device has not synced recently, is offline or the battery is low, contact the Smart Walk user and ask them to charge or move to better coverage.</p></div></div></div>;
}

function Contacts() {
  const app = useApp(); const [showAdd, setShowAdd] = useState(false); const [name, setName] = useState(""); const [relationship, setRelationship] = useState(""); const [phone, setPhone] = useState("");
  const add = (event: FormEvent) => { event.preventDefault(); app.addContact({ name, relationship, phone, priority: app.contacts.length + 1 }); setName(""); setRelationship(""); setPhone(""); setShowAdd(false); };
  return <div className="page-stack"><PageIntro eyebrow="Emergency support" title="Emergency contacts" text="Keep people easy to reach. Contacts are private to authorised caregivers." action={<button className="button button-primary" onClick={() => setShowAdd(true)}><Plus size={16} /> Add contact</button>} /><div className="card contacts-card">{app.contacts.map((contact) => <div className="contact-row" key={contact.id}><div className="contact-avatar">{initials(contact.name)}</div><div className="contact-info"><strong>{contact.name}</strong><span>{contact.relationship} · priority {contact.priority}</span></div><a className="phone-link" href={`tel:${contact.phone}`}><Phone size={16} /> {contact.phone}</a><button className="icon-button subtle" onClick={() => app.removeContact(contact.id)} aria-label={`Remove ${contact.name}`}><X size={17} /></button></div>)}{!app.contacts.length && <EmptyState icon={<Contact />} title="No emergency contacts" text="Add a trusted person so caregivers know who to call." />}</div>{showAdd && <Modal title="Add emergency contact" onClose={() => setShowAdd(false)}><form onSubmit={add} className="modal-form"><label>Contact name<input value={name} onChange={(e) => setName(e.target.value)} required /></label><label>Relationship<input value={relationship} onChange={(e) => setRelationship(e.target.value)} placeholder="Mother, uncle, neighbour..." required /></label><label>Phone number<input value={phone} onChange={(e) => setPhone(e.target.value)} required /></label><button className="button button-primary button-full">Add contact <Plus size={16} /></button></form></Modal>}</div>;
}

function SettingsPage() {
  const auth = useAuth(); const [saved, setSaved] = useState(false); return <div className="page-stack"><PageIntro eyebrow="Account controls" title="Settings" text="Manage your caregiver profile, notifications and privacy preferences." /><div className="settings-grid"><div className="card settings-card"><div className="card-head"><div><h3>Notifications</h3><span className="muted">Choose how you hear about important events.</span></div></div><Toggle label="Browser notifications" description="Show a notification when a new SOS arrives." defaultOn /><Toggle label="Alert sound" description="Play an alert sound for new SOS events." defaultOn /><Toggle label="Low battery reminders" description="Notify you when battery drops below the threshold." defaultOn={false} /></div><div className="card settings-card"><div className="card-head"><div><h3>Caregiver profile</h3><span className="muted">Your account identity and access.</span></div></div><ReadOnly label="Full name" value="Maya Kiz" /><ReadOnly label="Email" value={isSupabaseConfigured ? "Connected account" : "demo@smartwalk.app"} /><div className="settings-actions"><button className="button button-outline" onClick={() => setSaved(true)}><Save size={16} /> {saved ? "Saved" : "Save changes"}</button><button className="button button-danger-outline" onClick={() => auth.signOut()}><LogOut size={16} /> Sign out</button></div></div></div><div className="card danger-card"><div><h3>Privacy & security</h3><p>Location and profile data are restricted by database policies to linked caregivers. Ask an admin to unlink a device or delete an account.</p></div><Shield size={24} /></div></div>;
}

function AdminPanel() {
  const [code, setCode] = useState(""); const [created, setCreated] = useState(false); const [error, setError] = useState("");
  const [users, setUsers] = useState<{ id: string; display_name: string }[]>([]);
  const [devices, setDevices] = useState<{ id: string; device_identifier: string; smart_walk_user_id: string }[]>([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedDevice, setSelectedDevice] = useState("");
  const [userName, setUserName] = useState("");
  const [deviceIdentifier, setDeviceIdentifier] = useState("");
  const [deviceToken, setDeviceToken] = useState("");

  useEffect(() => {
    if (!supabase) return;
    void Promise.all([
      supabase.from("smart_walk_users").select("id, display_name").order("display_name"),
      supabase.from("devices").select("id, device_identifier, smart_walk_user_id").order("device_identifier"),
    ]).then(([userResult, deviceResult]) => {
      if (userResult.data) setUsers(userResult.data);
      if (deviceResult.data) setDevices(deviceResult.data);
    });
  }, []);

  const createUser = async () => {
    setError("");
    if (!supabase || !userName.trim()) return;
    const { data, error: createError } = await supabase.from("smart_walk_users").insert({ display_name: userName.trim() }).select("id, display_name").single();
    if (createError) { setError(createError.message); return; }
    setUsers((current) => [...current, data]);
    setSelectedUser(data.id);
    setUserName("");
  };

  const createDevice = async () => {
    setError("");
    if (!supabase || !selectedUser || !deviceIdentifier.trim() || !deviceToken.trim()) { setError("Select a user, then enter a device ID and device secret."); return; }
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(deviceToken));
    const tokenHash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    const { data, error: createError } = await supabase.from("devices").insert({
      device_identifier: deviceIdentifier.trim(),
      smart_walk_user_id: selectedUser,
      device_token_hash: tokenHash,
    }).select("id, device_identifier, smart_walk_user_id").single();
    if (createError) { setError(createError.message); return; }
    setDevices((current) => [...current, data]);
    setSelectedDevice(data.id);
    setDeviceIdentifier("");
    setDeviceToken("");
  };

  const generatePairingCode = async () => {
    setError("");
    if (!supabase || !selectedUser) { setError("Select or create a Smart Walk user first."); return; }
    const { data, error: codeError } = await supabase.rpc("generate_pairing_code", {
      target_user_id: selectedUser,
      target_device_id: selectedDevice || null,
    });
    if (codeError) { setError(codeError.message); return; }
    setCode(String(data));
    setCreated(true);
  };

  return <div className="page-stack"><PageIntro eyebrow="Project operator only" title="Admin panel" text="Create and link real Smart Walk users and hardware. Only authorised admins can access this panel." /><div className="admin-grid"><div className="card"><div className="card-head"><div><h3>Set up user and device</h3><span className="muted">Create a real profile and provision an ingest secret.</span></div><Shield className="muted-icon" size={20} /></div>{error && <div className="error-box"><AlertTriangle size={16} /> {error}</div>}<div className="admin-form"><label>Smart Walk user<select value={selectedUser} onChange={(event) => setSelectedUser(event.target.value)}><option value="">Select a user</option>{users.map((user) => <option key={user.id} value={user.id}>{user.display_name}</option>)}</select></label><div className="inline-action"><input value={userName} onChange={(event) => setUserName(event.target.value)} placeholder="New user name" /><button className="button button-outline" onClick={createUser}><Plus size={15} /> Add</button></div><label>Device<select value={selectedDevice} onChange={(event) => setSelectedDevice(event.target.value)}><option value="">No linked device yet</option>{devices.filter((device) => !selectedUser || device.smart_walk_user_id === selectedUser).map((device) => <option key={device.id} value={device.id}>{device.device_identifier}</option>)}</select></label><div className="inline-action"><input value={deviceIdentifier} onChange={(event) => setDeviceIdentifier(event.target.value)} placeholder="Device ID, e.g. SW-0001" /><input type="password" value={deviceToken} onChange={(event) => setDeviceToken(event.target.value)} placeholder="One-time device secret" /><button className="button button-outline" onClick={createDevice}>Provision</button></div></div><div className="pairing-preview"><div className="pairing-code">{created ? code : "•••• ••••"}</div><span>{created ? "Share securely. This code expires after 24 hours or one use." : "Generate a real pairing code after selecting a user."}</span></div><button className="button button-primary" onClick={generatePairingCode}><Plus size={16} /> {created ? "Generate new pairing code" : "Generate pairing code"}</button></div><div className="card"><div className="card-head"><div><h3>Admin checklist</h3><span className="muted">Complete these before hardware delivery.</span></div></div><Checklist done text="Create caregiver account" /><Checklist done={users.length > 0} text="Add Smart Walk user profile" /><Checklist done={devices.length > 0} text="Provision device ID and secret" /><Checklist done={created} text="Generate device pairing code" /><Checklist done={false} text="Device sends first heartbeat" /><Checklist done={false} text="Confirm GPS and SOS test" /></div></div><div className="info-banner"><CircleHelp size={18} /><div><strong>Hardware integration boundary</strong><p>The stick sends heartbeat, location or SOS JSON to <code>/functions/v1/device-ingest</code> with <code>x-device-id</code> and <code>x-device-token</code>. Never place the Supabase service role key on hardware or in the browser.</p></div></div></div>;
}

function AlertBanner({ alert }: { alert: SosEvent }) {
  return <div className="sos-banner"><div className="sos-pulse"><AlertTriangle size={22} /></div><div className="sos-copy"><strong>New SOS alert · {relativeTime(alert.triggeredAt)}</strong><span>{alert.location ? "Location is available. Caregiver attention is needed." : "Location unavailable. Contact the Smart Walk user directly."}</span></div><Link className="button button-light" to="/app/alerts">View alert <ChevronRight size={16} /></Link></div>;
}

function AlertRow({ alert, onOpen }: { alert: SosEvent; onOpen: () => void }) {
  return <button className="alert-row" onClick={onOpen}><div className={`alert-severity ${alert.status === "resolved" ? "resolved" : "urgent"}`}><AlertTriangle size={17} /></div><div className="alert-row-main"><div><strong>SOS event</strong><span>{alert.location ? "Location snapshot available" : "Location unavailable"}</span></div><div className="alert-row-time">{formatDate(alert.triggeredAt)}<StatusChip status={alert.status} /></div></div><ChevronRight size={18} className="muted-icon" /></button>;
}

function AlertDrawer({ alert, onClose }: { alert: SosEvent; onClose: () => void }) {
  const app = useApp(); const [note, setNote] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const action = async (kind: "ack" | "resolve") => { setBusy(true); setError(""); try { if (kind === "ack") await app.acknowledgeAlert(alert.id); else await app.resolveAlert(alert.id, note); onClose(); } catch (err) { setError(err instanceof Error ? err.message : "Could not update the alert."); } finally { setBusy(false); } };
  const current = app.alerts.find((item) => item.id === alert.id) ?? alert;
  return <div className="drawer-layer" onClick={onClose}><aside className="alert-drawer" onClick={(event) => event.stopPropagation()}><div className="drawer-head"><div><span className="eyebrow">SOS event</span><h2>Emergency alert</h2></div><button className="icon-button subtle" onClick={onClose}><X size={19} /></button></div><div className="drawer-status"><StatusChip status={current.status} /><span>Triggered {formatDate(current.triggeredAt)}</span></div><div className="timeline"><TimelineItem done title="SOS received" detail={formatDate(current.triggeredAt)} /><TimelineItem done={Boolean(current.acknowledgedAt)} title="Acknowledged" detail={current.acknowledgedAt ? `${current.acknowledgedBy} · ${formatDate(current.acknowledgedAt)}` : "Waiting for caregiver"} /><TimelineItem done={Boolean(current.resolvedAt)} title="Resolved" detail={current.resolvedAt ? formatDate(current.resolvedAt) : "Resolution note required"} /></div><div className="drawer-location">{current.location ? <><MapPin size={17} /><div><strong>{isFresh(current.location.recordedAt) ? "Location available" : "Last known location"}</strong><span>Updated {formatDate(current.location.recordedAt)} · {current.location.accuracyM}m accuracy</span></div></> : <><X size={17} /><div><strong>Location unavailable</strong><span>No GPS fix was attached to this alert.</span></div></>}</div>{current.resolutionNote && <div className="resolution-note"><strong>Resolution note</strong><p>{current.resolutionNote}</p></div>}{error && <div className="error-box"><AlertTriangle size={16} /> {error}</div>}{current.status === "new" && <button className="button button-primary button-full" disabled={busy} onClick={() => action("ack")}>Acknowledge alert <Check size={16} /></button>}{current.status !== "resolved" && <div className="resolve-form"><label>Resolution note{current.status === "new" && <span className="optional">Optional until resolve</span>}<textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What happened after you checked in?" /></label><button className="button button-outline button-full" disabled={busy || !note.trim()} onClick={() => action("resolve")}>Mark resolved <Check size={16} /></button></div>}<a className="button button-ghost button-full" href="tel:112"><Phone size={16} /> Call local emergency support</a></aside></div>;
}

function LocationMap({ compact = false }: { compact?: boolean }) {
  const app = useApp(); const position: [number, number] = app.location ? [app.location.latitude, app.location.longitude] : [28.6139, 77.209];
  return <div className={`leaflet-wrap ${compact ? "compact" : ""}`}><MapContainer center={position} zoom={14} scrollWheelZoom={false} className="leaflet-map"><TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" /><Marker position={position}><Popup>{app.location && isFresh(app.location.recordedAt) ? "Live location" : "Last known location"}<br />{app.user.displayName}</Popup></Marker>{app.location?.accuracyM && <MapCircle center={position} radius={app.location.accuracyM} pathOptions={{ color: "#2563EB", fillColor: "#2563EB", fillOpacity: 0.12 }} />}</MapContainer><div className="map-overlay"><span className={`status-dot ${app.location && isFresh(app.location.recordedAt) ? "online" : "warning"}`} />{app.location && isFresh(app.location.recordedAt) ? "Live location" : "Last known location"}</div></div>;
}

function PageIntro({ eyebrow, title, text, action }: { eyebrow: string; title: string; text: string; action?: ReactNode }) { return <div className="page-intro"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2><p className="muted intro-text">{text}</p></div>{action}</div>; }
function StatusCard({ icon, label, value, detail, tone }: { icon: ReactNode; label: string; value: string; detail: string; tone: string }) { return <div className={`stat-card ${tone}`}><div className="stat-icon">{icon}</div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>; }
function MiniStat({ icon, label, value, tone }: { icon: ReactNode; label: string; value: string; tone: string }) { return <div className={`mini-stat ${tone}`}><div>{icon}</div><span>{label}</span><strong>{value}</strong></div>; }
function Step({ number, title, text }: { number: string; title: string; text: string }) { return <div className="step"><span>{number}</span><h3>{title}</h3><p>{text}</p></div>; }
function Feature({ icon, title, text }: { icon: ReactNode; title: string; text: string }) { return <div className="feature"><div className="feature-icon">{icon}</div><h3>{title}</h3><p>{text}</p></div>; }
function ActivityItem({ icon, title, detail, time, tone }: { icon: ReactNode; title: string; detail: string; time: string; tone: string }) { return <div className="activity-item"><div className={`activity-icon ${tone}`}>{icon}</div><div><strong>{title}</strong><span>{detail}</span></div><time>{time}</time></div>; }
function SummaryPill({ label, value, tone }: { label: string; value: number; tone: string }) { return <div className={`summary-pill ${tone}`}><span>{label}</span><strong>{value}</strong></div>; }
function StatusChip({ status }: { status: Status }) { return <span className={`status-chip ${status === "new" ? "red" : status === "acknowledged" ? "amber" : "teal"}`}><span className="chip-dot" />{statusLabel(status)}</span>; }
function DetailRow({ label, value, indicator }: { label: string; value: string; indicator?: string }) { return <div className="detail-row"><span>{label}</span><strong>{indicator && <i className={`indicator ${indicator}`} />}{value}</strong></div>; }
function ReadOnly({ label, value }: { label: string; value: string }) { return <div className="readonly"><span>{label}</span><strong>{value}</strong></div>; }
function EmptyState({ icon, title, text }: { icon: ReactNode; title: string; text: string }) { return <div className="empty-state"><div>{icon}</div><h3>{title}</h3><p>{text}</p></div>; }
function Toggle({ label, description, defaultOn }: { label: string; description: string; defaultOn: boolean }) { const [on, setOn] = useState(defaultOn); return <button className="toggle-row" onClick={() => setOn(!on)}><div><strong>{label}</strong><span>{description}</span></div><span className={`toggle ${on ? "on" : ""}`}><i /></span></button>; }
function Checklist({ done, text }: { done: boolean; text: string }) { return <div className="checklist"><span className={done ? "done" : ""}>{done ? <Check size={14} /> : <span />}</span>{text}</div>; }
function TimelineItem({ done, title, detail }: { done: boolean; title: string; detail: string }) { return <div className="timeline-item"><span className={done ? "done" : ""}>{done && <Check size={13} />}</span><div><strong>{title}</strong><small>{detail}</small></div></div>; }
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) { return <div className="modal-layer" onClick={onClose}><div className="modal" onClick={(event) => event.stopPropagation()}><div className="drawer-head"><h2>{title}</h2><button className="icon-button subtle" onClick={onClose}><X size={19} /></button></div>{children}</div></div>; }
function LoadingScreen() { return <div className="loading-screen"><span className="spinner" /><span>Loading Smart Walk...</span></div>; }
function authErrorMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  if (message.includes("Unsupported provider") || message.includes("provider is not enabled")) {
    return "Google sign-in is not enabled in Supabase yet. Open Authentication → Providers → Google, enable it, and add Google OAuth credentials.";
  }
  return message;
}
function statusLabel(status: Status) { return status === "new" ? "New" : status === "acknowledged" ? "Acknowledged" : "Resolved"; }
function initials(name: string) { return name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase(); }
function isFresh(timestamp: string) { return Date.now() - new Date(timestamp).getTime() < 15 * 60 * 1000; }
function relativeTime(timestamp: string) { const minutes = Math.max(0, Math.round((Date.now() - new Date(timestamp).getTime()) / 60000)); if (minutes < 1) return "just now"; if (minutes < 60) return `${minutes}m ago`; const hours = Math.round(minutes / 60); if (hours < 24) return `${hours}h ago`; return `${Math.round(hours / 24)}d ago`; }
function formatDate(timestamp: string) { return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(timestamp)); }

export default App;
