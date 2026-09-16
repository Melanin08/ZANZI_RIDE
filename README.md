# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

## Zanzi Ride

Zanzi Ride is split into a React client and a Python Flask API server for the passenger app, driver app, and owner dashboard prototype.

## Project structure

```text
client/                 React + Vite frontend
  src/
  public/
  index.html
  vite.config.ts
server/                 Python + Flask backend
  app.py
  requirements.txt
```

## Run locally

```bash
npm install
pip install -r server/requirements.txt
npm run dev
```

To run the frontend by itself:

```bash
cd client
npm install
npm run dev
```

Then open the Vite URL shown in the terminal, usually `http://localhost:5173`.

This starts:

- Frontend: `http://localhost:5173`
- API server: `http://localhost:4000`

The Vite client proxies `/api` requests to the Flask server.

## Useful scripts

```bash
npm run dev:client   # Vite frontend only
npm run dev:server   # Flask API only
npm run build        # TypeScript check and production frontend build
npm run lint         # Oxlint
```

## API routes

- `GET /api/health`
- `GET /api/drivers`
- `GET /api/dashboard`
- `GET /api/events` (Server-Sent Events stream)
- `GET /api/rides`
- `POST /api/rides`
- `PATCH /api/rides/:rideId/status`

The frontend displays `API LIVE` when it is connected to Flask and shows the latest server event in the profile area. The current server uses in-memory demo data. Production work should add authentication, a persistent database, map providers, and payment integrations for cash and mobile money.
