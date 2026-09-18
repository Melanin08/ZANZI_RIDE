import { useEffect, useRef, useState } from "react";
import { createRide, subscribeToEvents } from "./api";
import "./App.css";

type RideStage = "home" | "searching" | "found" | "trip" | "rating";
type Language = "en" | "sw";
type LatLng = { lat: number; lng: number; accuracy?: number };

function getDistanceKm(from: LatLng, to: LatLng) {
  const earthRadiusKm = 6371;
  const latDelta = ((to.lat - from.lat) * Math.PI) / 180;
  const lngDelta = ((to.lng - from.lng) * Math.PI) / 180;
  const fromLat = (from.lat * Math.PI) / 180;
  const toLat = (to.lat * Math.PI) / 180;
  const curve =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(lngDelta / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(curve), Math.sqrt(1 - curve));
}

function formatTsh(amount: number) {
  return `TSh ${Math.round(amount / 100) * 100}`.replace(
    /\B(?=(\d{3})+(?!\d))/g,
    ",",
  );
}

function estimateFare(vehicle: string, distanceKm: number) {
  const pricing =
    vehicle === "Boda"
      ? { base: 1200, perKm: 650, minimum: 2000 }
      : vehicle === "XL"
        ? { base: 4500, perKm: 1350, minimum: 9000 }
        : { base: 2800, perKm: 1050, minimum: 5500 };
  const center = Math.max(pricing.minimum, pricing.base + distanceKm * pricing.perKm);
  const low = center * 0.92;
  const high = center * 1.12;

  return `${formatTsh(low)} - ${formatTsh(high)}`;
}

type AppMode = "passenger" | "driver" | "admin";

const modeRoutes: Record<AppMode, string> = {
  passenger: "/passenger",
  driver: "/driver",
  admin: "/admin",
};

function modeFromPath(pathname: string): AppMode {
  const section = pathname.split("/").filter(Boolean)[0];
  if (section === "driver") return "driver";
  if (section === "admin") return "admin";
  return "passenger";
}

function App() {
  const [stage, setStage] = useState<RideStage>("home");
  const [vehicle, setVehicle] = useState("Comfort");
  const [language, setLanguage] = useState<Language>("en");
  const [notice, setNotice] = useState("");
  const [apiStatus, setApiStatus] = useState<"connecting" | "live" | "offline">(
    "connecting",
  );
  const [lastEvent, setLastEvent] = useState("Waiting for server");
  const [currentMode, setCurrentMode] = useState<AppMode>(() =>
    modeFromPath(window.location.pathname),
  );

  useEffect(() => {
    const syncPath = () => setCurrentMode(modeFromPath(window.location.pathname));
    window.addEventListener("popstate", syncPath);
    return () => window.removeEventListener("popstate", syncPath);
  }, []);

  useEffect(() => {
    const canonical = modeRoutes[currentMode];
    if (window.location.pathname !== canonical) {
      window.history.replaceState(null, "", canonical);
    }
  }, [currentMode]);

  useEffect(() => {
    const unsubscribe = subscribeToEvents((event) => {
      setApiStatus("live");
      setLastEvent(
        event.type === "connected" ? "Connected to API" : event.type,
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

  return (
    <div className={`app-shell ${currentMode}-only`}>
      <main className="main-content">
        <header className="topbar passenger-topbar">
          <div className="brand compact-brand">
            <span className="brand-mark">Z</span>
            <span>
              {language === "sw" ? "Zanzi Ride" : "Zanzi Ride"}
              <small>
                {currentMode === "passenger"
                  ? language === "sw"
                    ? "App ya Mteja"
                    : "Passenger App"
                  : currentMode === "driver"
                    ? language === "sw"
                      ? "App ya Dereva"
                      : "Driver App"
                    : language === "sw"
                      ? "App ya Msimamizi"
                      : "Admin App"}
              </small>
            </span>
          </div>

          <div className="top-actions">
            <span className={`api-status ${apiStatus}`} title={lastEvent}>
              <i /> API {apiStatus === "live" ? "LIVE" : apiStatus.toUpperCase()}
            </span>
            <div className="language-switcher" aria-label="Language">
              <button
                className={language === "en" ? "active" : ""}
                onClick={() => setLanguage("en")}
              >
                EN
              </button>
              <button
                className={language === "sw" ? "active" : ""}
                onClick={() => setLanguage("sw")}
              >
                SW
              </button>
            </div>
            <div className="user-avatar">ZM</div>
            <div className="user-info">
              <strong>
                {currentMode === "passenger"
                  ? language === "sw"
                    ? "Mteja wa Zanzi"
                    : "Zanzi passenger"
                  : currentMode === "driver"
                    ? language === "sw"
                      ? "Dereva wa Zanzi"
                      : "Zanzi driver"
                    : language === "sw"
                      ? "Msimamizi wa Zanzi"
                      : "Zanzi admin"}
              </strong>
              <small>{lastEvent}</small>
            </div>
          </div>
        </header>

        {notice && (
          <div className="action-notice" role="status">
            {notice}
            <button onClick={() => setNotice("")}>Close</button>
          </div>
        )}

        <div id="workspace-content">
          {currentMode === "passenger" && (
            <Passenger
              stage={stage}
              setStage={setStage}
              vehicle={vehicle}
              setVehicle={setVehicle}
              language={language}
            />
          )}

          {currentMode === "driver" && <DriverBoard language={language} />}
          {currentMode === "admin" && <AdminBoard language={language} />}
        </div>
      </main>
    </div>
  );
}

function DriverBoard({ language }: { language: Language }) {
  const [online, setOnline] = useState(true);
  const [rides, setRides] = useState([
    { id: "R-2041", status: "New booking", pickup: "Forodhani Gardens", destination: "Abeid Amani Karume Airport", vehicle: "Comfort", fare: "TSh 25,000" },
    { id: "R-2042", status: "Accepted", pickup: "Stone Town", destination: "Nungwi Beach", vehicle: "XL", fare: "TSh 52,000" },
  ]);

  useEffect(() => {
    fetch("/api/rides")
      .then((response) => response.json())
      .then((payload) => {
        if (payload?.data?.length) setRides(payload.data.slice(0, 2));
      })
      .catch(() => undefined);
  }, []);

  return (
    <div className="page passenger-page">
      <div className="passenger-hero">
        <div>
          <p className="eyebrow">{language === "sw" ? "ZINZI DRIVER" : "ZINZI DRIVER"}</p>
          <h1>{language === "sw" ? "App ya dereva" : "Driver app"}</h1>
          <p>{language === "sw" ? "Jisajili, pokea booking, chukua safari, na ufuate mapato yako kwa wakati halisi." : "Register, receive bookings, accept rides, and monitor your income in real time."}</p>
        </div>
        <div className="hero-fare-card">
          <small>{language === "sw" ? "Mapato leo" : "Today income"}</small>
          <strong>TSh 540,000</strong>
          <span>{language === "sw" ? "Rating 4.9 • 18 trips" : "Rating 4.9 • 18 trips"}</span>
        </div>
      </div>

      <div className="passenger-grid">
        <section className="panel" style={{ padding: 22 }}>
          <div className="booking-header">
            <div>
              <p className="eyebrow">{language === "sw" ? "PROFILE" : "PROFILE"}</p>
              <h2>{language === "sw" ? "Mifumo ya dereva" : "Driver profile"}</h2>
            </div>
            <button className={online ? "primary-button" : "ghost-button"} onClick={() => setOnline(!online)} style={{ minHeight: 42, padding: "0 16px" }}>
              {online ? (language === "sw" ? "Online" : "Online") : (language === "sw" ? "Offline" : "Offline")}
            </button>
          </div>

          <div className="location-fields" style={{ paddingTop: 16 }}>
            <div className="location-line location-card">
              <span className="pin green">1</span>
              <div>
                <label>{language === "sw" ? "Jina" : "Name"}</label>
                <strong>Hassan Mwinyi</strong>
              </div>
            </div>
            <div className="location-line location-card">
              <span className="pin green">2</span>
              <div>
                <label>{language === "sw" ? "Namba ya simu" : "Phone"}</label>
                <strong>+255 712 000 000</strong>
              </div>
            </div>
            <div className="location-line location-card">
              <span className="pin green">3</span>
              <div>
                <label>{language === "sw" ? "License & Documents" : "License & Documents"}</label>
                <strong>{language === "sw" ? "Picha na nyaraka zimetumwa" : "Photo and documents uploaded"}</strong>
              </div>
            </div>
          </div>

          <div className="section-label">{language === "sw" ? "Booking mpya" : "New booking"}</div>
          <div className="passenger-history" style={{ marginTop: 12 }}>
            {rides.map((ride) => (
              <div className="history-row" key={ride.id} style={{ marginBottom: 8 }}>
                <div className="history-route">
                  <b>{ride.destination}</b>
                  <small>{ride.pickup}</small>
                </div>
                <div className="history-fare">
                  <b>{ride.vehicle}</b>
                  <small>{ride.status}</small>
                </div>
                <span>{ride.fare}</span>
              </div>
            ))}
          </div>

          <div className="journey-actions" style={{ marginTop: 18, gap: 10 }}>
            <button className="primary-button" style={{ flex: 1 }}>{language === "sw" ? "Kubali" : "Accept"}</button>
            <button className="ghost-button" style={{ flex: 1 }}>{language === "sw" ? "Kataa" : "Reject"}</button>
          </div>
        </section>

        <section className="map-card">
          <div className="map-toolbar">
            <span className="map-tag">{language === "sw" ? "LIVE MAP" : "LIVE MAP"}</span>
            <button>{language === "sw" ? "Naviga" : "Navigate"}</button>
            <button>{language === "sw" ? "Anza safari" : "Start trip"}</button>
          </div>
          <div className="live-map-frame">
            <iframe
              title="Driver live map"
              src="https://www.openstreetmap.org/export/embed.html?bbox=39.1181%2C-6.1905%2C39.2728%2C-6.1135&layer=mapnik&marker=-6.1622%2C39.1921"
            />
            <div className="driver-live-card">
              <div className="driver-photo">HM</div>
              <div>
                <small>{language === "sw" ? "Mteja" : "Customer"}</small>
                <b>Amina Ali</b>
                <span>{language === "sw" ? "Stone Town → Airport · ETA 18 min" : "Stone Town → Airport · ETA 18 min"}</span>
              </div>
            </div>
            <div className="map-bottom">
              <span>Z</span>
              <div>
                <b>{language === "sw" ? "Safari inayoendelea" : "Trip in progress"}</b>
                <small>{language === "sw" ? "Kuhamisha maelezo ya mteja kwenye ramani" : "Customer route visible on the live map"}</small>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function AdminBoard({ language }: { language: Language }) {
  const [selectedTab, setSelectedTab] = useState("Dashboard");
  const [stats] = useState([
    { label: language === "sw" ? "Safari zinazoendelea" : "Trips in progress", value: "18" },
    { label: language === "sw" ? "Drivers online" : "Drivers online", value: "42" },
    { label: language === "sw" ? "Customers" : "Customers", value: "1,240" },
    { label: language === "sw" ? "Mapato" : "Revenue", value: "TSh 3.4M" },
    { label: language === "sw" ? "Commission yako" : "Your commission", value: "TSh 510K" },
    { label: language === "sw" ? "Complaints" : "Complaints", value: "06" },
    { label: language === "sw" ? "Driver verification" : "Driver verification", value: "96%" },
    { label: language === "sw" ? "Pricing" : "Pricing", value: "Updated" },
    { label: language === "sw" ? "Promotions" : "Promotions", value: "04" },
    { label: language === "sw" ? "Reports" : "Reports", value: "Live" },
  ]);

  const drivers = [
    { name: "Driver 001", area: "Stone Town", status: "On trip" },
    { name: "Driver 002", area: "Airport", status: "Available" },
    { name: "Driver 003", area: "Nungwi", status: "On trip" },
  ];

  const liveDrivers = [
    "Driver 001 — Stone Town",
    "Driver 002 — Airport",
    "Driver 003 — Nungwi",
  ];

  const menuItems = [
    { label: language === "sw" ? "Dashibodi" : "Dashboard" },
    { label: language === "sw" ? "Wadereva" : "Drivers" },
    { label: language === "sw" ? "Safari" : "Trips" },
    { label: language === "sw" ? "Ripoti" : "Reports" },
    { label: language === "sw" ? "Mipangilio" : "Settings" },
  ];

  const activeSection =
    selectedTab === "Dashboard"
      ? "dashboard"
      : selectedTab === "Drivers"
        ? "drivers"
        : selectedTab === "Trips"
          ? "trips"
          : selectedTab === "Reports"
            ? "reports"
            : "settings";

  return (
    <div className="page passenger-page" style={{ width: "100%", minHeight: "100vh", margin: 0, padding: 0, overflow: "hidden" }}>
      <aside
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          bottom: 0,
          width: 260,
          background: "linear-gradient(180deg, #183f36 0%, #1d5d4e 100%)",
          color: "#fff",
          padding: "22px 16px",
          overflow: "hidden",
          borderRadius: 0,
          boxShadow: "inset -1px 0 0 rgba(255,255,255,0.08)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28, padding: "0 8px" }}>
          <div className="brand-mark" style={{ width: 30, height: 30, borderRadius: 10, display: "grid", placeItems: "center", background: "rgba(255,255,255,0.14)" }}>Z</div>
          <div>
            <strong style={{ fontSize: 18 }}>Zanzi Ride</strong>
            <small style={{ display: "block", color: "rgba(255,255,255,0.75)" }}>{language === "sw" ? "Admin" : "Admin"}</small>
          </div>
        </div>

        <nav style={{ display: "grid", gap: 10 }}>
          {menuItems.map((item) => (
            <button
              key={item.label}
              onClick={() => setSelectedTab(item.label)}
              style={{
                padding: "12px 14px",
                borderRadius: 12,
                border: selectedTab === item.label ? "1px solid rgba(255,255,255,0.35)" : "1px solid transparent",
                background: selectedTab === item.label ? "rgba(255,255,255,0.12)" : "transparent",
                color: "#fff",
                textAlign: "left",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <section style={{ marginLeft: 260, minWidth: 0, height: "100vh", background: "#f5f8f4", padding: "18px 18px 22px", borderRadius: 0, overflow: "auto" }}>
        <div className="passenger-hero">
          <div>
            <p className="eyebrow">{language === "sw" ? "ADMIN DASHBOARD" : "ADMIN DASHBOARD"}</p>
            <h1>{selectedTab}</h1>
            <p>{language === "sw" ? "Fuatilia ramani ya maisha, watendaji, mapato, na utendaji wa biashara ya Zanzi Ride kwa haraka." : "Monitor the live fleet, driver status, commission, and business performance for Zanzi Ride in one place."}</p>
          </div>
          <div className="hero-fare-card">
            <small>{language === "sw" ? "Mapato ya leo" : "Revenue today"}</small>
            <strong>TSh 3,400,000</strong>
            <span>{language === "sw" ? "Commission 15%" : "Commission 15%"}</span>
          </div>
        </div>

        {activeSection === "dashboard" && (
          <>
            <div className="admin-stats" style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(120px, 1fr))", gap: 12, margin: "18px 0" }}>
              {stats.map((stat) => (
                <div key={stat.label} className="panel" style={{ padding: "16px 14px" }}>
                  <small>{stat.label}</small>
                  <h3 style={{ margin: "8px 0 0" }}>{stat.value}</h3>
                </div>
              ))}
            </div>

            <div className="passenger-grid">
              <section className="panel" style={{ padding: 18 }}>
                <div className="booking-header">
                  <div>
                    <p className="eyebrow">{language === "sw" ? "LIVE MAP" : "LIVE MAP"}</p>
                    <h2>{language === "sw" ? "Usafiri wa wakati halisi" : "Live fleet view"}</h2>
                  </div>
                </div>
                <div className="live-map-frame" style={{ marginTop: 12 }}>
                  <iframe
                    title="Admin live map"
                    src="https://www.openstreetmap.org/export/embed.html?bbox=39.1218%2C-6.1958%2C39.2745%2C-6.1024&layer=mapnik&marker=-6.1622%2C39.1921"
                  />
                  <div className="map-bottom">
                    <span>Z</span>
                    <div>
                      <b>{language === "sw" ? "Wadereva wanaotumika" : "Active drivers"}</b>
                      <small>{liveDrivers.join(" • ")}</small>
                    </div>
                  </div>
                </div>
              </section>

              <section className="panel" style={{ padding: 18 }}>
                <div className="booking-header">
                  <div>
                    <p className="eyebrow">{language === "sw" ? "OPERATIONS" : "OPERATIONS"}</p>
                    <h2>{language === "sw" ? "Taarifa za usimamizi" : "Management overview"}</h2>
                  </div>
                </div>

                <div className="passenger-history" style={{ marginTop: 12 }}>
                  {drivers.map((driver) => (
                    <div className="history-row" key={driver.name} style={{ marginBottom: 8 }}>
                      <div className="history-route">
                        <b>{driver.name}</b>
                        <small>{driver.area}</small>
                      </div>
                      <div className="history-fare">
                        <b>{language === "sw" ? "Hali" : "Status"}</b>
                        <small>{driver.status}</small>
                      </div>
                      <span>{language === "sw" ? "Angalia" : "View"}</span>
                    </div>
                  ))}
                </div>

                <div className="fare-row" style={{ marginTop: 18 }}>
                  <div>
                    <small>{language === "sw" ? "Mfumo wa malipo" : "Payment system"}</small>
                    <strong>{language === "sw" ? "Cash + Mobile Money" : "Cash + Mobile Money"}</strong>
                  </div>
                  <span className="cash-badge">{language === "sw" ? "Card · Wallet · Corporate" : "Card · Wallet · Corporate"}</span>
                </div>
              </section>
            </div>
          </>
        )}

        {activeSection === "drivers" && (
          <div className="panel" style={{ padding: 20 }}>
            <h2>{language === "sw" ? "Wadereva" : "Drivers"}</h2>
            <div className="passenger-history" style={{ marginTop: 16 }}>
              {drivers.map((driver) => (
                <div className="history-row" key={driver.name} style={{ marginBottom: 8 }}>
                  <div className="history-route">
                    <b>{driver.name}</b>
                    <small>{driver.area}</small>
                  </div>
                  <div className="history-fare">
                    <b>{language === "sw" ? "Hali" : "Status"}</b>
                    <small>{driver.status}</small>
                  </div>
                  <span>{language === "sw" ? "Verified" : "Verified"}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeSection === "trips" && (
          <div className="panel" style={{ padding: 20 }}>
            <h2>{language === "sw" ? "Safari" : "Trips"}</h2>
            <div className="passenger-history" style={{ marginTop: 16 }}>
              {[
                { id: "R-2041", route: "Stone Town → Airport", amount: "TSh 25,000", status: "In progress" },
                { id: "R-2042", route: "Stone Town → Nungwi", amount: "TSh 52,000", status: "Completed" },
                { id: "R-2043", route: "Airport → Unguja", amount: "TSh 18,500", status: "Accepted" },
              ].map((trip) => (
                <div className="history-row" key={trip.id} style={{ marginBottom: 8 }}>
                  <div className="history-route">
                    <b>{trip.id}</b>
                    <small>{trip.route}</small>
                  </div>
                  <div className="history-fare">
                    <b>{trip.amount}</b>
                    <small>{trip.status}</small>
                  </div>
                  <span>{language === "sw" ? "View" : "View"}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeSection === "reports" && (
          <div className="panel" style={{ padding: 20 }}>
            <h2>{language === "sw" ? "Ripoti" : "Reports"}</h2>
            <div className="fare-row" style={{ marginTop: 16 }}>
              <div>
                <small>{language === "sw" ? "Mapato ya mwezi" : "Monthly revenue"}</small>
                <strong>TSh 18,400,000</strong>
              </div>
              <span className="cash-badge">+12.8%</span>
            </div>
            <div className="fare-row" style={{ marginTop: 12 }}>
              <div>
                <small>{language === "sw" ? "Ajira ya dereva" : "Driver productivity"}</small>
                <strong>96%</strong>
              </div>
              <span className="cash-badge">Healthy</span>
            </div>
          </div>
        )}

        {activeSection === "settings" && (
          <div className="panel" style={{ padding: 20 }}>
            <h2>{language === "sw" ? "Mipangilio" : "Settings"}</h2>
            <div className="fare-row" style={{ marginTop: 16 }}>
              <div>
                <small>{language === "sw" ? "Malipo" : "Payments"}</small>
                <strong>{language === "sw" ? "Cash + Mobile Money" : "Cash + Mobile Money"}</strong>
              </div>
              <span className="cash-badge">{language === "sw" ? "Updated" : "Updated"}</span>
            </div>
            <div className="fare-row" style={{ marginTop: 12 }}>
              <div>
                <small>{language === "sw" ? "Uchaguzi wa bei" : "Pricing"}</small>
                <strong>{language === "sw" ? "Zanzibar standard" : "Zanzibar standard"}</strong>
              </div>
              <span className="cash-badge">{language === "sw" ? "Active" : "Active"}</span>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function Passenger({
  stage,
  setStage,
  vehicle,
  setVehicle,
  language,
}: {
  stage: RideStage;
  setStage: (stage: RideStage) => void;
  vehicle: string;
  setVehicle: (vehicle: string) => void;
  language: Language;
}) {
  const [destination, setDestination] = useState("");
  const [rideError, setRideError] = useState("");
  const [rideId, setRideId] = useState("");
  const destinationInputRef = useRef<HTMLInputElement | null>(null);
  const isSwahili = language === "sw";
  const text = {
    appTitle: isSwahili ? "Zanzi Ride" : "Zanzi Ride",
    heroTitle: isSwahili ? "Uko wapi unakwenda" : "Where are you going",
    heroSubtitle: isSwahili
      ? "Ingiza sehemu ya kukokota na ya kufika, chagua aina ya gari, angalia makadirio ya bei, na uombe safari."
      : "Enter pickup and destination, choose the car type, check the estimated price, then request your ride.",
    rideRequest: isSwahili ? "Omba safari" : "Request Ride",
    tripDetails: isSwahili ? "Maelezo ya safari" : "Trip details",
    pickupLocation: isSwahili ? "Mahali pa kukokota" : "Pickup location",
    destination: isSwahili ? "Destinasi" : "Destination",
    vehicleType: isSwahili ? "Aina ya gari" : "Car type",
    estimatedFare: isSwahili ? "Makadirio ya bei" : "Estimated fare",
    payment: isSwahili ? "Malipo" : "Payment",
    requestRide: isSwahili ? "Omba safari" : "Request Ride",
    useLiveLocation: isSwahili ? "Tumia eneo la moja kwa moja" : "Use live location",
    openMap: isSwahili ? "Fungua ramani" : "Open map",
    driverOnMap: isSwahili ? "Kuona dereva kwenye ramani" : "See driver on map",
    driverName: isSwahili ? "Jina + picha ya dereva" : "Driver name + photo",
    carPlate: isSwahili ? "Namba ya gari" : "Car number plate",
    eta: isSwahili ? "ETA" : "ETA",
    call: isSwahili ? "Piga simu" : "Call",
    chat: isSwahili ? "Chat" : "Chat",
    rating: isSwahili ? "Rating ⭐" : "Rating ⭐",
    tripHistory: isSwahili ? "Historia ya safari" : "Trip history",
    noFees: isSwahili ? "Hakuna ada za siri" : "No hidden fees",
    driverInfo: isSwahili ? "Taarifa ya dereva yataheshimiwa kabla ya kukokotwa" : "Driver details shown before pickup",
    ready: isSwahili ? "Tayari" : "Ready",
    active: isSwahili ? "Inafanya kazi" : "Active",
    noPrice: isSwahili ? "Bado hakuna bei" : "No price yet",
    bookingMessage: isSwahili ? "Jina na plate ya gari yataheshimiwa baada ya dereva kukutafuta" : "You will see the driver, plate number, ETA, call, and chat before pickup.",
    driverFound: isSwahili ? "Dereva amepatikana" : "Driver found",
    lookingForDriver: isSwahili ? "Tunatafuta dereva karibu" : "Looking for a nearby driver",
    requestSent: isSwahili ? "Maombi yametumwa" : "Ride requested",
    rideInProgress: isSwahili ? "Safari inaendelea" : "Trip in progress",
    driverReady: isSwahili ? "Hassan yuko dakika 4 away" : "Hassan is 4 minutes away",
    rateTrip: isSwahili ? "Pima safari" : "Rate the ride",
    completed: isSwahili ? "Safari imekamilika" : "Trip complete",
    paymentSummary: isSwahili ? "Malipo" : "Payment",
    done: isSwahili ? "Imekamilika" : "Done",
    startTrip: isSwahili ? "Anza safari" : "Start trip",
    endTrip: isSwahili ? "Maliza safari" : "End trip",
    actionReady: isSwahili ? "Tayari kuomba safari" : "Ready to request a ride",
    driverDetails: isSwahili ? "Taarifa za dereva" : "Driver details",
    yourDriver: isSwahili ? "Dereva wako" : "Your driver",
    enterDestinationFirst: isSwahili ? "Andika sehemu ya kufika kwanza" : "Enter destination first",
    selectListedDestination: isSwahili ? "Chagua sehemu iliyoorodheshwa ili kukokotoa bei" : "Select a listed destination",
    priceAppears: isSwahili ? "Bei itaonekana baada ya sehemu ya kukokota na ya kufika" : "Price appears after pickup and destination",
    liveLocationUnsupported: isSwahili ? "Eneo la moja kwa moja halitumiki kwenye kivinjari hiki" : "Live location is not supported in this browser",
    gettingLocation: isSwahili ? "Tunapata eneo lako la moja kwa moja..." : "Getting your live location...",
    locationConfirmed: isSwahili ? "Eneo la kukokota limehakikishwa ndani ya" : "Live pickup confirmed within",
    allowLocation: isSwahili ? "Ruhusu ufikiaji wa eneo ili kutumia sehemu ya kukokota" : "Allow location access to use live pickup",
    activeLocation: isSwahili ? "Eneo la moja kwa moja linatumika ndani ya" : "Live location active within",
    pausedLocation: isSwahili ? "Eneo la moja kwa moja limesitishwa. Angalia ruhusa ya kivinjari." : "Live location paused. Check browser permission.",
    chooseDestination: isSwahili ? "Chagua sehemu ya kufika kwanza" : "Choose a destination first",
    requestRideError: isSwahili ? "Chagua sehemu ya kufika ili kuhesabu bei ya safari." : "Select a listed destination so we can calculate the route price.",
    rideRequested: isSwahili ? "Safari imeandikiwa. Tunatafuta dereva karibu." : "Ride requested. Looking for a nearby driver.",
    rideRequestCancelled: isSwahili ? "Maombi ya safari yameghairiwa" : "Ride request cancelled",
    cancel: isSwahili ? "Ghairi" : "Cancel",
    vehiclePlate: isSwahili ? "Namba ya gari" : "Vehicle plate",
    onWayTo: isSwahili ? "Katika safari ya kuelekea Abeid Amani Karume Airport" : "On the way to Abeid Amani Karume Airport",
    eta18: isSwahili ? "ETA 18 dakika. Weka malipo tayari kufika." : "ETA 18 minutes. Keep payment ready for arrival.",
    endTripAndPay: isSwahili ? "Maliza safari na ulipie" : "End trip and pay",
    tripComplete: isSwahili ? "SAFARI IMEKAMILIKA" : "TRIP COMPLETE",
    rateRide: isSwahili ? "Pima safari" : "Rate the ride",
    paymentLabel: isSwahili ? "Malipo" : "Payment",
    close: isSwahili ? "Funga" : "Close",
    searching: isSwahili ? "Inatafuta" : "Searching",
    booking: isSwahili ? "Maelezo ya booking" : "Booking",
    ratingSelected: (stars: number) => isSwahili ? `Uchaguzi wa rating: nyota ${stars}` : `Rating selected: ${stars} stars`,
    rideId: isSwahili ? "ID ya safari" : "Ride ID",
    chooseDestinationPrompt: isSwahili ? "Wapi unakoenda?" : "Where are you going?",
  };
  const [passengerAction, setPassengerAction] = useState(
    isSwahili ? "Tayari kuomba safari" : "Ready to request a ride",
  );
  const [paymentMethod, setPaymentMethod] = useState(isSwahili ? "Cash" : "Cash");
  const [liveLocation, setLiveLocation] = useState<LatLng | null>(null);
  const [locationStatus, setLocationStatus] = useState(() =>
    "geolocation" in navigator
      ? isSwahili ? "Gusa Use live location kuthibitisha kukokota" : "Tap Use live location to confirm pickup"
      : text.liveLocationUnsupported,
  );
  const defaultLocation: LatLng = { lat: -6.1622, lng: 39.1921 };
  const mapCenter = liveLocation ?? defaultLocation;

  const knownDestinations: Record<string, LatLng> = {
    "Abeid Amani Karume Airport": { lat: -6.222, lng: 39.2249 },
    "Nungwi Beach": { lat: -5.7264, lng: 39.2987 },
    "Stone Town Ferry Terminal": { lat: -6.1581, lng: 39.1897 },
  };

  const selectedDestination = Object.entries(knownDestinations).find(
    ([place]) => place.toLowerCase() === destination.trim().toLowerCase(),
  );

  const routeDistanceKm = selectedDestination
    ? getDistanceKm(mapCenter, selectedDestination[1])
    : null;

  const fareEstimate = routeDistanceKm !== null
    ? estimateFare(vehicle, routeDistanceKm)
    : null;

  const fareDisplay = !destination.trim()
    ? text.enterDestinationFirst
    : fareEstimate ?? text.selectListedDestination;

  const rideOptions = [
    ["Boda", isSwahili ? "Pikipiki" : "Motorbike", isSwahili ? "Kiburi cha safari fupi" : "Best for quick short trips", "2"],
    ["Comfort", isSwahili ? "Gari" : "Car", isSwahili ? "Safi kwa safari za kila siku" : "Good for daily rides", "4"],
    ["XL", isSwahili ? "Gari kubwa" : "Large car", isSwahili ? "Kituo cha mizigo zaidi" : "More space for bags", "6"],
  ];
  const mapBox = {
    left: mapCenter.lng - 0.018,
    right: mapCenter.lng + 0.018,
    bottom: mapCenter.lat - 0.014,
    top: mapCenter.lat + 0.014,
  };
  const livePickupLabel = liveLocation
    ? `${isSwahili ? "Eneo la moja kwa moja" : "Live location"}: ${liveLocation.lat.toFixed(5)}, ${liveLocation.lng.toFixed(5)}`
    : isSwahili ? "Forodhani Gardens, Stone Town" : "Forodhani Gardens, Stone Town";
  const mapSource = `https://www.openstreetmap.org/export/embed.html?bbox=${mapBox.left}%2C${mapBox.bottom}%2C${mapBox.right}%2C${mapBox.top}&layer=mapnik&marker=${mapCenter.lat}%2C${mapCenter.lng}`;
  const liveTracking = liveLocation !== null;

  const useLiveLocation = () => {
    if (!("geolocation" in navigator)) {
      setLocationStatus(text.liveLocationUnsupported);
      return;
    }

    setLocationStatus(text.gettingLocation);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLiveLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        setLocationStatus(
          `${text.locationConfirmed} ${Math.round(position.coords.accuracy)} m`,
        );
        setPassengerAction(isSwahili ? "Eneo la kukokota limebadilishwa" : "Pickup updated to live location");
      },
      () => {
        setLocationStatus(text.allowLocation);
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 12000 },
    );
  };

  useEffect(() => {
    if (!liveTracking || !("geolocation" in navigator)) return undefined;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setLiveLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        setLocationStatus(
          `${text.activeLocation} ${Math.round(position.coords.accuracy)} m`,
        );
      },
      () => setLocationStatus(text.pausedLocation),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [liveTracking]);

  const requestRide = () => {
    if (stage !== "home") {
      setStage(
        stage === "searching" ? "found" : stage === "found" ? "trip" : "rating",
      );
      return;
    }

    if (!destination.trim()) {
      setRideError(text.chooseDestination);
      return;
    }

    if (!fareEstimate) {
      setRideError(text.requestRideError);
      return;
    }

    createRide({
      pickup: livePickupLabel,
      destination,
      vehicle,
      paymentMethod,
    })
      .then((result) => {
        setRideId(result.data.id);
        setRideError("");
        setPassengerAction(text.rideRequested);
        setStage("searching");
      })
      .catch(() => setRideError(isSwahili ? "Anza Flask server ili kuomba safari." : "Start the Flask server to request a ride."));
  };

  const callDriver = () => {
    setPassengerAction(isSwahili ? "Inapiga simu Hassan Mwinyi" : "Calling Hassan Mwinyi");
    window.location.href = "tel:+255712000000";
  };

  const chatDriver = () => {
    setPassengerAction(isSwahili ? "Fungua mazungumzo na Hassan Mwinyi" : "Opening chat with Hassan Mwinyi");
    window.location.href = "sms:+255712000000";
  };

  const openMap = () => {
    window.open(
      `https://www.openstreetmap.org/?mlat=${mapCenter.lat}&mlon=${mapCenter.lng}#map=16/${mapCenter.lat}/${mapCenter.lng}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  return (
    <div className="page passenger-page">
      <div className="passenger-hero">
        <div>
          <p className="eyebrow">{text.appTitle}</p>
          <h1>{text.heroTitle}</h1>
          <p>{text.heroSubtitle}</p>
        </div>
        <div className="hero-fare-card">
          <small>Makadirio ya bei</small>
          <strong>{fareDisplay}</strong>
          <span>
            {fareEstimate && routeDistanceKm
              ? `${vehicle} ride - ${routeDistanceKm.toFixed(1)} km - ${paymentMethod}`
              : text.priceAppears}
          </span>
        </div>
      </div>

      <div className="passenger-grid">
        <section className="booking-panel panel">
          <div className="booking-header">
            <div>
              <p className="eyebrow">{isSwahili ? "OMBA SAFARI" : "REQUEST RIDE"}</p>
              <h2>{text.tripDetails}</h2>
            </div>
            <span>{text.active}</span>
          </div>

          <div className="location-fields">
            <div className="location-line location-card">
              <span className="pin green">1</span>
              <div>
                <label>{text.pickupLocation}</label>
                <strong>{livePickupLabel}</strong>
                <small>{locationStatus}</small>
              </div>
              <button className="location-action" onClick={useLiveLocation}>
                Use live location
              </button>
            </div>
            <div className="route-line" />
            <div
              className="location-line location-card destination-click-area"
              onClick={() => destinationInputRef.current?.focus()}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  destinationInputRef.current?.focus();
                }
              }}
              role="button"
              tabIndex={0}
              aria-label="Where are you going?"
            >
              <span className="pin red">2</span>
              <div>
                <label>{text.destination}</label>
                <input
                  ref={destinationInputRef}
                  aria-label="Destination"
                  className="destination-input"
                  onChange={(event) => {
                    setDestination(event.target.value);
                    setRideError("");
                    setPassengerAction(isSwahili ? "Destinasi imebadilishwa" : "Destination updated");
                  }}
                  value={destination}
                  placeholder={isSwahili ? "Wapi unakoenda?" : "Where are you going?"}
                  onClick={(event) => event.stopPropagation()}
                />
              </div>
            </div>
          </div>

          <div className="compact-destinations" aria-label={isSwahili ? "Sehemu maarufu" : "Popular destinations"}>
            {Object.keys(knownDestinations).map((place) => (
              <button
                className={destination === place ? "active" : ""}
                key={place}
                onClick={() => {
                  setDestination(place);
                  setRideError("");
                  setPassengerAction(isSwahili ? "Destinasi imechaguliwa" : "Destination selected");
                }}
              >
                {place}
              </button>
            ))}
          </div>

          <div className="section-label">{text.vehicleType}</div>
          <div className="ride-options">
            {rideOptions.map(([name, type, detail, seats]) => (
              <button
                className={vehicle === name ? "ride-option active" : "ride-option"}
                key={name}
                onClick={() => {
                  setVehicle(name);
                  setPassengerAction(isSwahili ? `${name} imechaguliwa` : `${name} selected`);
                }}
              >
                <span className="vehicle-icon">{seats}</span>
                <b>{name}</b>
                <small>{type}</small>
                <small>{detail}</small>
              </button>
            ))}
          </div>

          <div className="fare-row">
            <div>
              <small>{text.estimatedFare}</small>
              <strong>{fareDisplay}</strong>
            </div>
            <span className="cash-badge">
              {fareEstimate ? `${routeDistanceKm?.toFixed(1)} km route` : text.noPrice}
            </span>
          </div>

          <div className="section-label">{text.payment}</div>
          <div className="payment-methods" aria-label="Payment method">
            {["Cash", "M-Pesa", "Airtel Money"].map((method) => (
              <button
                className={paymentMethod === method ? "active" : ""}
                key={method}
                onClick={() => {
                  setPaymentMethod(method);
                  setPassengerAction(isSwahili ? `${method} imechaguliwa` : `${method} selected`);
                }}
              >
                {method}
              </button>
            ))}
          </div>

          <button className="primary-button" onClick={requestRide}>
            {stage === "searching"
              ? isSwahili ? "Onesha dereva" : "Show driver"
              : stage === "found"
                ? text.startTrip
                : stage === "trip"
                  ? text.endTrip
                  : text.requestRide}
            <span>{isSwahili ? "Endelea" : "Next"}</span>
          </button>
          <div className="booking-footnote">
            <span>{text.noFees}</span>
            <span>{text.driverInfo}</span>
          </div>
          {rideError && (
            <small className="ride-error" role="alert">
              {rideError}
            </small>
          )}
          {rideId && <small className="ride-id">Ride ID: {rideId}</small>}
        </section>

        <section className="map-card">
          <div className="map-toolbar">
            <span className="map-tag">{text.driverOnMap}</span>
            <button onClick={useLiveLocation}>Use live location</button>
            <button onClick={openMap}>{text.openMap}</button>
          </div>
          <div className="live-map-frame">
            <iframe
              aria-label="Live pickup location map"
              src={mapSource}
              title="Live pickup location map"
            />
            <div className="live-pickup-card">
              <span>1</span>
              <div>
                <b>{text.pickupLocation}</b>
                <small>{livePickupLabel}</small>
              </div>
            </div>
            {stage !== "home" && (
              <div className="driver-live-card">
                <div className="driver-photo">HM</div>
                <div>
                  <small>{text.driverName}</small>
                  <b>Hassan Mwinyi</b>
                  <span>{isSwahili ? "Namba ya gari: Z 428 HMM - ETA: 4 min" : "Car number: Z 428 HMM - ETA: 4 min"}</span>
                </div>
                <button onClick={callDriver}>{text.call}</button>
                <button onClick={chatDriver}>{text.chat}</button>
              </div>
            )}
            <div className="map-bottom">
              <span>Z</span>
              <div>
                <b>
                  {stage === "searching"
                    ? (isSwahili ? "Tunatafuta dereva karibu" : "Finding a nearby driver")
                    : stage === "found"
                      ? (isSwahili ? "Hassan yuko dakika 4 away" : "Hassan is 4 minutes away")
                      : stage === "trip"
                        ? (isSwahili ? "Safari inaendelea" : "Trip in progress")
                        : (isSwahili ? "Chagua destinasi kuanza" : "Choose a destination to start")}
                </b>
                <small>
                  {stage === "home"
                    ? (fareEstimate && routeDistanceKm ? `${vehicle} - ${routeDistanceKm.toFixed(1)} km - ${paymentMethod}` : text.priceAppears)
                    : text.bookingMessage}
                </small>
              </div>
            </div>
          </div>
        </section>
      </div>

      <PassengerJourney
        callDriver={callDriver}
        chatDriver={chatDriver}
        isSwahili={isSwahili}
        rideId={rideId}
        setPassengerAction={setPassengerAction}
        setStage={setStage}
        stage={stage}
        text={text}
      />

      <div className="passenger-action-status" role="status">
        {passengerAction}
      </div>
    </div>
  );
}

function PassengerJourney({
  callDriver,
  chatDriver,
  isSwahili,
  stage,
  setStage,
  rideId,
  setPassengerAction,
  text,
}: {
  callDriver: () => void;
  chatDriver: () => void;
  isSwahili: boolean;
  stage: RideStage;
  setStage: (stage: RideStage) => void;
  rideId: string;
  setPassengerAction: (message: string) => void;
  text: {
    lookingForDriver: string;
    cancel: string;
    rideRequestCancelled: string;
    searching: string;
    driverFound: string;
    carPlate: string;
    payment: string;
    eta: string;
    call: string;
    chat: string;
    startTrip: string;
    onWayTo: string;
    eta18: string;
    endTripAndPay: string;
    done: string;
    tripComplete: string;
    rateRide: string;
    paymentLabel: string;
    ratingSelected: (stars: number) => string;
    close: string;
  };
}) {
  if (stage === "home") {
    return null;
  }

  if (stage === "searching") {
    return (
      <section className="journey-panel panel searching-panel">
        <div className="journey-loader" />
        <div>
          <p className="eyebrow">{isSwahili ? "SAFARI IMEOMBIWA" : "RIDE REQUESTED"}</p>
          <h2>{text.lookingForDriver}</h2>
          <p className="muted">{isSwahili ? "Maombi yako yamepelekwa kwa madereva walioko karibu na Stone Town." : "Your request has been sent to available drivers near Stone Town."}</p>
          <small>{rideId ? `${isSwahili ? "Booking" : "Booking"} ${rideId}` : text.searching}</small>
        </div>
        <button
          className="ghost-button"
          onClick={() => {
            setStage("home");
            setPassengerAction(text.rideRequestCancelled);
          }}
        >
          {text.cancel}
        </button>
      </section>
    );
  }

  if (stage === "found") {
    return (
      <section className="journey-panel panel driver-found-panel">
        <div className="driver-profile">
          <div className="driver-photo">HM</div>
          <div>
            <p className="eyebrow">{text.driverFound.toUpperCase()}</p>
            <h2>
              Hassan Mwinyi <span>{isSwahili ? "Rating 4.9" : "4.9 rating"}</span>
            </h2>
            <p className="muted">{isSwahili ? "Toyota Vitz, nyeupe. Namba Z 428 HMM." : "Toyota Vitz, white. Plate Z 428 HMM."}</p>
          </div>
        </div>
        <div className="ride-facts">
          <div>
            <small>{text.carPlate}</small>
            <b>Z 428 HMM</b>
          </div>
          <div>
            <small>{text.eta}</small>
            <b>4 min</b>
          </div>
          <div>
            <small>{text.payment}</small>
            <b>{isSwahili ? "Cash / mobile money" : "Cash / mobile money"}</b>
          </div>
        </div>
        <div className="journey-actions">
          <button onClick={callDriver}>{text.call}</button>
          <button onClick={chatDriver}>{text.chat}</button>
          <button className="primary-button small" onClick={() => setStage("trip")}>
            {text.startTrip}
          </button>
        </div>
      </section>
    );
  }

  if (stage === "trip") {
    return (
      <section className="journey-panel panel live-trip-panel">
        <div>
          <p className="eyebrow">{isSwahili ? "SAFARI ILIYOANZISHA" : "LIVE TRIP"}</p>
          <h2>{text.onWayTo}</h2>
          <p className="muted">{text.eta18}</p>
        </div>
        <div className="trip-driver-row">
          <div className="driver-photo small">HM</div>
          <div>
            <b>Hassan Mwinyi</b>
            <small>Z 428 HMM, Toyota Vitz</small>
          </div>
          <button onClick={chatDriver}>{text.chat}</button>
        </div>
        <button className="primary-button" onClick={() => setStage("rating")}>
          {text.endTripAndPay} <span>{text.done}</span>
        </button>
      </section>
    );
  }

  return (
    <section className="journey-panel panel rating-panel">
      <div>
        <p className="eyebrow">{text.tripComplete}</p>
        <h2>{text.rateRide}</h2>
        <p className="muted">{isSwahili ? "Ukadiriaji wako husaidia kuweka Zanzi Ride salama na ya kuaminika." : "Your rating helps keep Zanzi Ride safe and reliable."}</p>
      </div>
      <div className="payment-summary">
        <span>{text.paymentLabel}</span>
        <strong>TSh 9,500</strong>
      </div>
      <div className="rating-stars">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            aria-label={`${star} star rating`}
            key={star}
            onClick={() => setPassengerAction(text.ratingSelected(star))}
          >
            ★
          </button>
        ))}
      </div>
      <button className="primary-button" onClick={() => setStage("home")}>
        {text.done} <span>{text.close}</span>
      </button>
    </section>
  );
}

export default App;

