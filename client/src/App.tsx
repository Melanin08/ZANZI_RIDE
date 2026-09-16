import { useEffect, useState } from "react";
import { createRide, getDashboard, subscribeToEvents, type DashboardData } from "./api";
import "./App.css";

type Mode = "passenger" | "driver" | "admin";
type RideStage = "home" | "searching" | "found" | "trip" | "rating";
type Language = "en" | "sw";

const drivers = [
  {
    name: "Driver 001",
    place: "Stone Town",
    initials: "AM",
    color: "#e4b84a",
    status: "On trip",
  },
  {
    name: "Driver 002",
    place: "Airport",
    initials: "SH",
    color: "#e8795d",
    status: "Available",
  },
  {
    name: "Driver 003",
    place: "Nungwi",
    initials: "HM",
    color: "#4e9c88",
    status: "Available",
  },
];

function App() {
  const [mode, setMode] = useState<Mode>("passenger");
  const [stage, setStage] = useState<RideStage>("home");
  const [vehicle, setVehicle] = useState("Comfort");
  const [activeNav, setActiveNav] = useState("Overview");
  const [language, setLanguage] = useState<Language>("en");
  const [notice, setNotice] = useState("");
  const [, setDashboard] = useState<DashboardData | null>(null);
  const [apiStatus, setApiStatus] = useState<"connecting" | "live" | "offline">(
    "connecting",
  );
  const [lastEvent, setLastEvent] = useState("Waiting for server events");
  useEffect(() => {
    getDashboard()
      .then((result) => setDashboard(result.data))
      .catch(() => undefined);
    const unsubscribe = subscribeToEvents((event) => {
      setApiStatus("live");
      setLastEvent(
        event.type === "connected"
          ? "Connected to server"
          : `Server event: ${event.type}`,
      );
    });
    const timeout = window.setTimeout(
      () =>
        setApiStatus((status) =>
          status === "connecting" ? "offline" : status,
        ),
      3000,
    );
    return () => {
      window.clearTimeout(timeout);
      unsubscribe();
    };
  }, []);
  const navItems =
    mode === "admin"
      ? [
          "Overview",
          "Live map",
          "Drivers",
          "Customers",
          "Trips",
          "Finance",
          "Reports",
        ]
      : mode === "driver"
        ? ["Dashboard", "Requests", "Earnings", "Trip history", "Profile"]
        : ["Home", "Activity", "Wallet", "Profile"];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">Z</span>
          <span>
            Zanzi <small>Ride</small>
          </span>
        </div>
        <div className="mode-label">WORKSPACE</div>
        <div className="role-switcher">
          {(["passenger", "driver", "admin"] as Mode[]).map((item) => (
            <button
              className={mode === item ? "role active" : "role"}
              key={item}
              onClick={() => {
                setMode(item);
                setActiveNav(item === "passenger" ? "Home" : item === "driver" ? "Dashboard" : "Overview");
                document.getElementById("workspace-content")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              {item === "passenger"
                ? "Passenger"
                : item === "driver"
                  ? "Driver"
                  : "Admin"}
            </button>
          ))}
        </div>
        <nav>
          {navItems.map((item) => (
            <button
              className={item === activeNav ? "nav-item selected" : "nav-item"}
              key={item}
              onClick={() => {
                setActiveNav(item);
                setNotice(`${item} selected`);
                document.getElementById("workspace-content")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              {item}
              {item === "Requests" && <b>3</b>}
            </button>
          ))}
        </nav>
        <button className="sidebar-bottom" onClick={() => setNotice("Support contact opened")}>
          <div>
            <strong>Need help?</strong>
            <small>Contact support</small>
          </div>
          <span>Open</span>
        </button>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setNotice("Menu ready")}>☰</button>
          <div className="crumb">
            Zanzi Ride /{" "}
            <strong>{activeNav}</strong>
          </div>
          <div className="top-actions">
            <span className={`api-status ${apiStatus}`} title={lastEvent}>
              <i /> API{" "}
              {apiStatus === "live" ? "LIVE" : apiStatus.toUpperCase()}
            </span>
            <div className="language-switcher" aria-label="Language">
              <button className={language === "en" ? "active" : ""} onClick={() => setLanguage("en")}>EN</button>
              <button className={language === "sw" ? "active" : ""} onClick={() => setLanguage("sw")}>SW</button>
            </div>
            <button className="icon-button" onClick={() => setNotice("Search opened")}>⌕</button>
            <button className="icon-button notification" onClick={() => setNotice("No new notifications")}>
              ♧<i />
            </button>
            <div className="user-avatar">ZM</div>
            <div className="user-info">
              <strong>
                {mode === "admin"
                  ? "Zahra M."
                  : mode === "driver"
                    ? "Hassan Mwinyi"
                    : "Zahra Mohamed"}
              </strong>
              <small>{lastEvent}</small>
            </div>
            <span className="chevron">⌄</span>
          </div>
        </header>
        {notice && <div className="action-notice" role="status">{notice}<button onClick={() => setNotice("")}>Close</button></div>}
        <div id="workspace-content">
        {mode === "passenger" && activeNav === "Home" && (
          <Passenger
            stage={stage}
            setStage={setStage}
            vehicle={vehicle}
            setVehicle={setVehicle}
          />
        )}
        {mode === "passenger" && activeNav !== "Home" && <WorkspaceView mode={mode} section={activeNav} language={language} />}
        {mode === "driver" && activeNav === "Dashboard" && <Driver />}
        {mode === "driver" && activeNav !== "Dashboard" && <WorkspaceView mode={mode} section={activeNav} language={language} />}
        {mode === "admin" && activeNav === "Overview" && <Admin />}
        {mode === "admin" && activeNav !== "Overview" && <WorkspaceView mode={mode} section={activeNav} language={language} />}
        </div>
      </main>
    </div>
  );
}

function WorkspaceView({ mode, section, language }: { mode: Mode; section: string; language: Language }) {
  const copy = language === "sw"
    ? { activity: "Shughuli za safari", wallet: "Mkoba wa malipo", profile: "Wasifu wako", requests: "Maombi mapya", earnings: "Mapato yako", history: "Historia ya safari", overview: "Muhtasari", live: "Ramani ya moja kwa moja", drivers: "Madereva", customers: "Wateja", trips: "Safari", finance: "Fedha", reports: "Ripoti" }
    : { activity: "Ride activity", wallet: "Payment wallet", profile: "Your profile", requests: "New ride requests", earnings: "Your earnings", history: "Trip history", overview: "Overview", live: "Live map", drivers: "Drivers", customers: "Customers", trips: "Trips", finance: "Finance", reports: "Reports" };
  const labels: Record<string, string> = { Activity: copy.activity, Wallet: copy.wallet, Profile: copy.profile, Requests: copy.requests, Earnings: copy.earnings, "Trip history": copy.history, Overview: copy.overview, "Live map": copy.live, Drivers: copy.drivers, Customers: copy.customers, Trips: copy.trips, Finance: copy.finance, Reports: copy.reports };
  const title = labels[section] ?? section;
  return <div className="page workspace-view"><div className="page-heading"><div><p className="eyebrow">{mode.toUpperCase()} / {section.toUpperCase()}</p><h1>{title}</h1><p className="muted">{language === "sw" ? "Hapa ndipo taarifa zako zinaonekana." : "This section is ready for your next action."}</p></div><button className="outline-button" onClick={() => window.alert(`${title} opened`)}>{language === "sw" ? "Fungua" : "Open section"} →</button></div><div className="workspace-cards"><section className="panel workspace-hero"><span className="workspace-symbol">{mode === "admin" ? "▦" : mode === "driver" ? "◷" : "◉"}</span><h2>{title}</h2><p>{language === "sw" ? "Dhibiti taarifa, safari na mipangilio kutoka kwenye ukurasa huu." : "Manage the information, trips, and settings for this workspace from here."}</p><button className="primary-button small" onClick={() => window.alert(`${title} action started`)}>{language === "sw" ? "Anza" : "Start action"} <span>→</span></button></section><section className="panel workspace-list"><p className="eyebrow">{language === "sw" ? "MUHTASARI" : "SUMMARY"}</p>{[1, 2, 3].map((item) => <button key={item} onClick={() => window.alert(`${title} item ${item} selected`)}><span className="list-dot" />{language === "sw" ? `Kipengele ${item}` : `${title} item ${item}`}<b>→</b></button>)}</section></div></div>;
}

function Passenger({
  stage,
  setStage,
  vehicle,
  setVehicle,
}: {
  stage: RideStage;
  setStage: (stage: RideStage) => void;
  vehicle: string;
  setVehicle: (vehicle: string) => void;
}) {
  const [tab, setTab] = useState<"book" | "schedule">("book");
  const [destination, setDestination] = useState("Enter destination");
  const [zoom, setZoom] = useState(1);
  const [rideError, setRideError] = useState("");
  const [rideId, setRideId] = useState("");
  const requestRide = () => {
    if (stage !== "home") {
      setStage(stage === "searching" ? "found" : stage === "found" ? "trip" : "rating");
      return;
    }
    if (destination === "Enter destination") {
      setRideError("Choose a destination first");
      return;
    }
    createRide({ pickup: "Forodhani Gardens, Stone Town", destination, vehicle, paymentMethod: "cash" })
      .then((result) => {
        setRideId(result.data.id);
        setRideError("");
        setStage("searching");
      })
      .catch(() => setRideError("Server is unavailable. Start python server/app.py."));
  };
  return (
    <div className="page passenger-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            GOOD MORNING, ZAHRA <span>✦</span>
          </p>
          <h1>Where are you going?</h1>
          <p className="muted">
            Your island, your ride. Move freely around Zanzibar.
          </p>
        </div>
        <div className="status-pill">
          <span /> Zanzibar · 28°C
        </div>
      </div>
      <div className="passenger-grid">
        <section className="booking-panel panel">
          <div className="panel-tabs">
            <button className={tab === "book" ? "tab active" : "tab"} onClick={() => setTab("book")}>Book a ride</button>
            <button className={tab === "schedule" ? "tab active" : "tab"} onClick={() => setTab("schedule")}>Schedule</button>
          </div>
          <div className="location-fields">
            <div className="location-line">
              <span className="pin green">●</span>
              <div>
                <label>Pickup location</label>
                <strong>Forodhani Gardens, Stone Town</strong>
              </div>
              <span className="cross">×</span>
            </div>
            <div className="route-line" />
            <div className="location-line">
              <span className="pin red">●</span>
              <div>
                <label>Where to?</label>
                <strong className="placeholder">{destination}</strong>
              </div>
              <span className="cross">⌕</span>
            </div>
          </div>
          <div className="quick-locations">
            <span>Recent</span>
            <button onClick={() => setDestination("Maruhubi Palace")}>
              ⌖ <b>Maruhubi Palace</b>
              <small>6.4 km</small>
            </button>
            <button onClick={() => setDestination("Abeid Amani Karume Airport")}>
              ⌖ <b>Abeid Amani Karume Airport</b>
              <small>8.1 km</small>
            </button>
          </div>
          <div className="section-label">Choose your ride</div>
          <div className="ride-options">
            {[
              ["Boda", "♧", "From TSh 2,000"],
              ["Comfort", "▱", "From TSh 8,500"],
              ["XL", "▰", "From TSh 12,000"],
            ].map(([name, icon, price]) => (
              <button
                key={name}
                className={
                  vehicle === name ? "ride-option active" : "ride-option"
                }
                onClick={() => setVehicle(name)}
              >
                <span className="vehicle-icon">{icon}</span>
                <b>{name}</b>
                <small>{price}</small>
                {vehicle === name && <span className="check">✓</span>}
              </button>
            ))}
          </div>
          <div className="fare-row">
            <div>
              <small>Estimated fare</small>
              <strong>
                {vehicle === "Boda"
                  ? "TSh 2,000 – 4,000"
                  : vehicle === "XL"
                    ? "TSh 12,000 – 16,000"
                    : "TSh 8,500 – 11,000"}
              </strong>
            </div>
            <span className="cash-badge">▣ Cash</span>
          </div>
          <button
            className="primary-button"
            onClick={requestRide}
          >
            {stage === "home"
              ? "Request ride"
              : stage === "searching"
                ? "Finding your driver…"
                : stage === "found"
                  ? "Confirm ride"
                  : stage === "trip"
                    ? "Complete trip"
                    : "Rate your ride"}{" "}
            <span>→</span>
          </button>
          {rideError && <small className="ride-error" role="alert">{rideError}</small>}
          {rideId && <small className="ride-id">Ride ID: {rideId}</small>}
        </section>
        <section className="map-card">
          <div className="map-toolbar">
            <span className="map-tag">LIVE MAP</span>
            <button onClick={() => setZoom((value) => Math.min(value + 0.1, 1.3))}>＋</button>
            <button onClick={() => setZoom((value) => Math.max(value - 0.1, 0.8))}>−</button>
          </div>
          <div className="map-grid" style={{ transform: `scale(${zoom})`, transformOrigin: "center" }}>
            <div className="map-water">
              ZANZIBAR
              <br />
              <small>CHANNEL</small>
            </div>
            <div className="route route-one" />
            <div className="route route-two" />
            <div className="road road-a" />
            <div className="road road-b" />
            <div className="map-label label-stone">STONE TOWN</div>
            <div className="map-label label-airport">AIRPORT</div>
            <div className="map-pin pickup">
              ●<small>You</small>
            </div>
            <div className="map-pin car car-one">◆</div>
            <div className="map-pin car car-two">◆</div>
            <div className="map-pin destination">●</div>
            <div className="map-bottom">
              <span>◉</span>
              <div>
                <b>
                  {stage === "home"
                    ? "Ready when you are"
                    : stage === "searching"
                      ? "Finding nearby drivers"
                      : stage === "found"
                        ? "Driver found · 4 min away"
                        : "Your trip is in progress"}
                </b>
                <small>
                  {stage === "home"
                    ? "Set your destination to get started"
                    : "Live location updates enabled"}
                </small>
              </div>
            </div>
          </div>
        </section>
      </div>
      <section className="blueprint">
        <div>
          <p className="eyebrow">ZANZI RIDE APP BLUEPRINT</p>
          <h2>Every step, thoughtfully connected.</h2>
        </div>
        <div className="flow">
          {[
            "Splash",
            "Login",
            "Home",
            "Location",
            "Fare",
            "Searching",
            "Driver found",
            "Live trip",
            "Payment",
            "Rating",
          ].map((item, index) => (
            <div
              className={index === 2 ? "flow-step current" : "flow-step"}
              key={item}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              {item}
              {index < 9 && <b>→</b>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Driver() {
  const [online, setOnline] = useState(true);
  const [requestStatus, setRequestStatus] = useState("New request");
  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">DRIVER APP / TODAY</p>
          <h1>Good morning, Hassan.</h1>
          <p className="muted">You are making island journeys possible.</p>
        </div>
        <button className="online-toggle" onClick={() => setOnline((value) => !value)}>
          <span /> {online ? "Online" : "Offline"} <b>⌄</b>
        </button>
      </div>
      <div className="driver-stats">
        <div className="stat-card">
          <span className="stat-icon orange">◒</span>
          <small>Today's earnings</small>
          <strong>TSh 84,500</strong>
          <em>↑ 12.4% vs yesterday</em>
        </div>
        <div className="stat-card">
          <span className="stat-icon teal">◷</span>
          <small>Trips completed</small>
          <strong>08</strong>
          <em>↑ 2 from yesterday</em>
        </div>
        <div className="stat-card">
          <span className="stat-icon blue">★</span>
          <small>Your rating</small>
          <strong>4.92</strong>
          <em>Top 10% of drivers</em>
        </div>
      </div>
      <div className="driver-grid">
        <section className="panel request-panel">
          <div className="panel-title">
            <div>
              <p className="eyebrow">NEW REQUEST</p>
              <h2>Airport → Nungwi</h2>
            </div>
            <span className="timer">0:18</span>
          </div>
          <div className="request-route">
            <div>
              <span className="pin green">●</span>
              <b>Abeid Amani Karume Airport</b>
              <small>Terminal 1 · Pickup in 3 min</small>
            </div>
            <div className="route-line" />
            <div>
              <span className="pin red">●</span>
              <b>Nungwi Beach Resort</b>
              <small>23.6 km · Approx. 46 min</small>
            </div>
          </div>
          <div className="request-footer">
            <div>
              <small>Estimated earnings</small>
              <strong>TSh 32,000</strong>
            </div>
            <button className="ghost-button" onClick={() => setRequestStatus("Request declined")}>Decline</button>
            <button className="primary-button small" onClick={() => setRequestStatus("Ride accepted")}>Accept ride →</button>
            <small className="request-feedback">{requestStatus}</small>
          </div>
        </section>
        <section className="panel driver-map">
          <div className="map-heading">
            <h2>Driver location</h2>
            <span className="live-dot">Live now</span>
          </div>
          <div className="mini-map">
            <div className="island-shape" />
            <div className="mini-road one" />
            <div className="mini-road two" />
            <div className="map-pin car mini-car">◆</div>
            <div className="map-pin mini-destination">●</div>
            <span className="mini-label">Stone Town</span>
            <span className="mini-label north">Nungwi</span>
          </div>
        </section>
      </div>
    </div>
  );
}

function Admin() {
  const [action, setAction] = useState("Ready");
  return (
    <div className="page admin-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">WEDNESDAY, 16 SEPTEMBER 2026</p>
          <h1>Good morning, Zahra.</h1>
          <p className="muted">Here is what is happening across Zanzi today.</p>
        </div>
        <button className="date-button" onClick={() => setAction("Date filter opened")}>
          ▣ Today, 16 Sep <span>⌄</span>
        </button>
      </div>
      <div className="admin-stats">
        <div>
          <small>Gross revenue</small>
          <strong>TSh 4.82M</strong>
          <em>↑ 18.6%</em>
          <span>Compared to last week</span>
        </div>
        <div>
          <small>Active trips</small>
          <strong>38</strong>
          <em>↑ 8.2%</em>
          <span>12 awaiting drivers</span>
        </div>
        <div>
          <small>Drivers online</small>
          <strong>
            126 <i>/ 284</i>
          </strong>
          <em className="neutral">44.4%</em>
          <span>Across Zanzibar</span>
        </div>
        <div>
          <small>Platform commission</small>
          <strong>TSh 724K</strong>
          <em>↑ 21.3%</em>
          <span>15% average rate</span>
        </div>
      </div>
      <div className="admin-grid">
        <section className="panel live-map-panel">
          <div className="panel-title">
            <div>
              <p className="eyebrow">OPERATIONS CENTER</p>
              <h2>Live driver map</h2>
            </div>
            <button className="outline-button" onClick={() => setAction("Full live map opened")}>View full map ↗</button>
          </div>
          <div className="admin-map">
            <div className="map-contours c1" />
            <div className="map-contours c2" />
            <div className="admin-road r1" />
            <div className="admin-road r2" />
            <div className="admin-road r3" />
            <div className="admin-pin pin1">
              <span>◆</span>
              <b>Driver 001</b>
              <small>Stone Town</small>
            </div>
            <div className="admin-pin pin2">
              <span>◆</span>
              <b>Driver 002</b>
              <small>Airport</small>
            </div>
            <div className="admin-pin pin3">
              <span>◆</span>
              <b>Driver 003</b>
              <small>Nungwi</small>
            </div>
            <div className="admin-map-footer">
              <span>●</span>
              <b>126 drivers online</b>
              <small>Updated just now</small>
            </div>
          </div>
        </section>
        <section className="panel activity-panel">
          <div className="panel-title">
            <div>
              <p className="eyebrow">RIGHT NOW</p>
              <h2>Live activity</h2>
            </div>
            <button className="more-button" onClick={() => setAction("Activity options opened")}>···</button>
          </div>
          <div className="activity-list">
            <div>
              <span className="activity-icon ride">↗</span>
              <p>
                <b>Trip started</b>
                <small>Driver 014 · Kisauni → Mbweni</small>
              </p>
              <time>2m</time>
            </div>
            <div>
              <span className="activity-icon money">TSh</span>
              <p>
                <b>Payment received</b>
                <small>Trip #ZR-2048 · Cash</small>
              </p>
              <time>4m</time>
            </div>
            <div>
              <span className="activity-icon alert">!</span>
              <p>
                <b>Driver verification</b>
                <small>3 documents need review</small>
              </p>
              <time>8m</time>
            </div>
            <div>
              <span className="activity-icon user">+</span>
              <p>
                <b>New passenger signup</b>
                <small>Amir Juma · Zanzibar City</small>
              </p>
              <time>12m</time>
            </div>
          </div>
          <button className="full-link" onClick={() => setAction("All activity opened")}>
            View all activity <span>→</span>
          </button>
        </section>
      </div>
      <div className="bottom-panels">
        <section className="panel table-panel">
          <div className="panel-title">
            <div>
              <p className="eyebrow">FLEET</p>
              <h2>Driver status</h2>
            </div>
            <button className="outline-button" onClick={() => setAction("Driver management opened")}>Manage drivers ↗</button>
          </div>
          <table>
            <thead>
              <tr>
                <th>DRIVER</th>
                <th>LOCATION</th>
                <th>STATUS</th>
                <th>TRIPS TODAY</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((driver) => (
                <tr key={driver.name}>
                  <td>
                    <span
                      className="table-avatar"
                      style={{ background: driver.color }}
                    >
                      {driver.initials}
                    </span>
                    <b>{driver.name}</b>
                  </td>
                  <td>{driver.place}</td>
                  <td>
                    <span
                      className={
                        driver.status === "Available"
                          ? "table-status available"
                          : "table-status trip"
                      }
                    >
                      <i />
                      {driver.status}
                    </span>
                  </td>
                  <td>
                    {driver.name === "Driver 001"
                      ? "06"
                      : driver.name === "Driver 002"
                        ? "04"
                        : "08"}
                  </td>
                  <td>···</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="panel quick-panel">
          <p className="eyebrow">QUICK ACTIONS</p>
          <h2>Keep things moving.</h2>
          <button onClick={() => setAction("Driver verification opened")}>
            ♙{" "}
            <span>
              Review drivers <small>3 pending applications</small>
            </span>
            <b>→</b>
          </button>
          <button onClick={() => setAction("Pricing editor opened")}>
            ◔{" "}
            <span>
              Update pricing <small>Peak pricing is off</small>
            </span>
            <b>→</b>
          </button>
          <button onClick={() => setAction("Reports opened")}>
            ▥{" "}
            <span>
              View reports <small>August performance</small>
            </span>
            <b>→</b>
          </button>
        </section>
      </div>
      <div className="admin-action-status" role="status">{action}</div>
    </div>
  );
}

export default App;
