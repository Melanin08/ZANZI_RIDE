# Zanzi Ride

Zanzi Ride is a realistic ride-hailing MVP for Zanzibar. The prototype is split into three separate development web apps:

- Passenger app: pickup, destination, vehicle type, fare estimate, ride request, driver details, payment, rating, and trip history area.
- Driver app: online/offline status, ride request, accept/reject, route details, earnings, rating, and trip history area.
- Owner dashboard: live driver map, active trips, drivers online, revenue, commission, verification, pricing, complaints, and reports areas.

The first payment scope is cash and mobile money. Card, wallet, and corporate billing should come later after the core ride flow is stable.

## Project structure

```text
client/                 React + Vite frontend
  src/
  public/
  index.html
server/                 Python + Flask API
  app.py
  requirements.txt
```

## Run locally

```bash
npm install
pip install -r server/requirements.txt
npm run dev
```

This starts:

- Frontend: `http://localhost:5173`
- API server: `http://localhost:4000`

The Vite client proxies `/api` requests to Flask.

During development, each web app has its own URL and navigation:

- Passenger app: `http://localhost:5173/passenger`
- Driver app: `http://localhost:5173/driver`
- Owner dashboard: `http://localhost:5173/owner`

The root URL redirects to the passenger app, and `/admin` also opens the owner dashboard.

## Useful scripts

```bash
npm run dev:client
npm run dev:server
npm run build
npm run lint
```

## API routes

- `GET /api/health`
- `GET /api/drivers`
- `GET /api/dashboard`
- `GET /api/events`
- `GET /api/rides`
- `POST /api/rides`
- `PATCH /api/rides/:rideId/status`
- `POST /api/rides/:rideId/accept`

Production work still needs authentication, real driver/passenger accounts, a proper database, map provider integration, live GPS updates, and mobile-money provider integration.
