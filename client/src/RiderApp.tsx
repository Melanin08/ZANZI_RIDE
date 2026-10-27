import { useEffect, useState, type ReactNode } from "react";
import type { Ride } from "./api";
import "./RiderApp.css";

import { authRequest, type User } from "./riderAuth";
export function AuthScreen({ onAuthenticated }: { onAuthenticated: (user: User) => void }) {
  const [register, setRegister] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <main className="rider-auth"><div className="auth-card"><span className="rider-wordmark">zanzi<span>ride</span></span><h1>{register ? "Your next stop starts here." : "Welcome back."}</h1><p>{register ? "Create your account once. We’ll keep you signed in on this device." : "Sign in to get moving again."}</p>
    <form onSubmit={async event => {
      event.preventDefault(); setBusy(true); setError("");
      const fields = new FormData(event.currentTarget);
      try { const data = await authRequest(register ? "register" : "login", Object.fromEntries(fields)); onAuthenticated(data.user); }
      catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to connect. Please try again."); }
      finally { setBusy(false); }
    }}>
      {register && <label>Full name<input name="name" autoComplete="name" required maxLength={100} /></label>}
      <label>Email<input name="email" type="email" autoComplete="email" required /></label>
      <label>Password<input name="password" type="password" autoComplete={register ? "new-password" : "current-password"} minLength={8} required /></label>
      {error && <p role="alert" className="rider-error">{error}</p>}
      <button className="rider-primary" disabled={busy}>{busy ? "Please wait…" : register ? "Create account" : "Sign in"}</button>
    </form><button className="auth-toggle" onClick={() => { setRegister(!register); setError(""); }}>{register ? "Already have an account? Sign in" : "New here? Create an account"}</button></div></main>;
}
function Icon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    home: <><path d="m3 10 9-7 9 7"/><path d="M5 9v12h5v-7h4v7h5V9"/></>,
    activity: <><path d="M6 3h12v19l-3-2-3 2-3-2-3 2Z"/><path d="M9 7h6M9 11h6M9 15h3"/></>,
    account: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="9" r="3"/><path d="M5.5 18c1-5 12-5 13 0"/></>,
    pin: <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
    search: <><circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 2v6M17 2v6M3 11h18M12 14v5M9.5 16.5h5"/></>,
  };
  return <svg viewBox="0 0 24 24" fill={name === "home" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
function Vehicle({ boda = false }: { boda?: boolean }) {
  return <svg className="service-vehicle" viewBox="0 0 180 95" aria-hidden="true">
    <ellipse cx="90" cy="80" rx="65" ry="7" fill="#d8deda"/>
    {boda ? <><g fill="#222b2a" stroke="#111b18" strokeWidth="5"><circle cx="45" cy="64" r="19"/><circle cx="137" cy="64" r="19"/></g><g fill="none" stroke="#34b67b" strokeWidth="8" strokeLinejoin="round"><path d="m45 64 30-27 27 28H45l39-10h39l-8-37"/><path d="m117 19 20 45"/></g><path d="M66 30h34l12 15H78Z" fill="#248e60"/><path d="M52 29h38" stroke="#28322e" strokeWidth="9" strokeLinecap="round"/><path d="m112 17 16-3" stroke="#27332e" strokeWidth="5"/><circle cx="128" cy="22" r="5" fill="#f8efcb"/></> : <><path d="m24 46 18-24c16-13 55-12 77 0l29 22 10 5v20H24Z" fill="#fafbfa" stroke="#c7ceca" strokeWidth="2"/><path d="m49 26-12 18h91l-19-18c-14-7-44-8-60 0Z" fill="#263130"/><path d="M70 47h39v23H70Z" fill="#39c587"/><path d="m110 49 35 2" stroke="#b4bdb7" strokeWidth="3"/><g fill="#222b28"><ellipse cx="49" cy="68" rx="13" ry="15"/><ellipse cx="130" cy="68" rx="13" ry="15"/></g><g fill="#818d86"><ellipse cx="49" cy="68" rx="6" ry="8"/><ellipse cx="130" cy="68" rx="6" ry="8"/></g></>}
  </svg>;
}
export function RiderApp({ user, onSignOut, onVehicle, booking, activeRide }: { activeRide: boolean; user: User; onSignOut: () => void; onVehicle: (vehicle: string) => void; booking: (destination: string) => ReactNode }) {
  const [tab, setTab] = useState("home");
  const [bookingOpen, setBookingOpen] = useState(false);
  const [destination, setDestination] = useState("");
  const [rides, setRides] = useState<Ride[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (tab !== "activity") return;
    let active = true;
    authRequest("rides").then(data => { if (active) setRides(data.data); })
      .catch(() => { if (active) setError("Couldn’t load your rides. Please try again."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [tab]);
  const openBooking = (vehicle?: string, place = "") => { if (vehicle) onVehicle(vehicle); setDestination(place); setBookingOpen(true); };
  return <div className="rider-shell"><main className="rider-content">
    {tab === "home" && !bookingOpen && <>
      <h1>Next stop, anywhere.</h1>
      <div className="service-cards"><button onClick={() => openBooking("Comfort")}><Vehicle/><strong>Rides</strong><span>Let’s get moving</span></button><button onClick={() => openBooking("Boda")}><Vehicle boda/><strong>Boda</strong><span>2-wheel rides</span></button></div>
      <button className="where-to" onClick={() => openBooking()}><Icon name="search"/><strong>Where to?</strong></button>
      <div className="suggested-places">{[
        ["Stone Town Ferry Terminal", "Stone Town, Zanzibar"],
        ["Abeid Amani Karume Airport", "Zanzibar"],
        ["Nungwi Beach", "Nungwi, Zanzibar"],
      ].map(([place, area]) => <button key={place} onClick={() => openBooking(undefined, place)}><span className="place-icon"><Icon name="pin"/></span><span><strong>{place}</strong><small>{area}</small></span></button>)}</div>
      <RideReminder/>
    </>}
    {bookingOpen && <div hidden={tab !== "home"}>{!activeRide && <button className="back-home" onClick={() => setBookingOpen(false)}>Back to home</button>}<div key={destination}>{booking(destination)}</div></div>}
    {tab === "activity" && <section className="rider-section"><h1>Activity</h1><p className="rider-muted">Your journeys, all in one place.</p>{loading ? <p role="status">Loading your rides…</p> : error ? <p role="alert">{error}</p> : rides.length ? rides.map(ride => <article className="activity-card" key={ride.id}><span className="place-icon"><Icon name="pin"/></span><div><strong>{ride.destination}</strong><p>{ride.pickup}</p><small>{new Date(ride.createdAt).toLocaleDateString()} · {ride.vehicle} · {ride.status.replaceAll("_", " ")}</small><p>{ride.estimatedFare}</p></div></article>) : <div className="empty-activity"><Icon name="activity"/><h2>Your first ride awaits</h2><p>Your rides will appear here after you book.</p><button className="rider-primary" onClick={() => { setTab("home"); if (!activeRide) setBookingOpen(false); }}>Find a ride</button></div>}</section>}
    {tab === "account" && <section className="rider-section"><h1>Account</h1><div className="account-profile"><Icon name="account"/><h2>{user.name}</h2><p>{user.email}</p></div><div className="account-session"><strong>You’re signed in</strong><p>Your account stays signed in on this device, including when you close and reopen the app.</p></div>{error && <p role="alert">{error}</p>}<button className="sign-out" disabled={loading} onClick={async () => { setLoading(true); setError(""); try { await authRequest("logout", {}); onSignOut(); } catch { setError("Couldn’t sign out. Please try again."); } finally { setLoading(false); } }}>Sign out</button></section>}
  </main><nav className="rider-bottom-nav" aria-label="Main navigation">{["home", "activity", "account"].map(item => <button key={item} className={tab === item ? "active" : ""} aria-current={tab === item ? "page" : undefined} onClick={() => { setTab(item); setError(""); setLoading(item === "activity"); if (item === "home" && !activeRide) setBookingOpen(false); }}><Icon name={item}/><span>{item[0].toUpperCase() + item.slice(1)}</span></button>)}</nav></div>;
}

function RideReminder() {
  const [open, setOpen] = useState(false);
  return <><button className="calendar-banner" onClick={() => setOpen(!open)} aria-expanded={open}><span className="calendar-icon"><Icon name="calendar"/></span><span><strong>Always arrive on time</strong><small>Add a ride reminder to your calendar</small></span><span aria-hidden="true">?</span></button>
  {open && <form className="reminder-form" onSubmit={event => {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get("departure") as string;
    const start = new Date(value);
    const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const calendar = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Zanzi Ride//Ride Reminder//EN", "BEGIN:VEVENT", "UID:" + crypto.randomUUID() + "@zanzi-ride", "DTSTAMP:" + stamp(new Date()), "DTSTART:" + stamp(start), "DTEND:" + stamp(new Date(start.getTime() + 15 * 60000)), "SUMMARY:Time to book your Zanzi Ride", "DESCRIPTION:Open Zanzi Ride to request your ride. This reminder does not book a ride.", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    const url = URL.createObjectURL(new Blob([calendar], { type: "text/calendar;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "zanzi-ride-reminder.ics"; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000); setOpen(false);
  }}><label>When do you want to book a ride?<input type="datetime-local" name="departure" required /></label><p>This creates a calendar reminder. Request your ride in the app when you?re ready.</p><button className="rider-primary">Download reminder</button></form>}</>;
}
