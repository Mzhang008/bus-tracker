# CTA Transit Tracker

Real-time Chicago CTA bus and train tracker built with Expo (React Native for Web + Mobile) and a Node.js/Express backend proxy.

## Features

- **Live Vehicle Tracking** — Polls CTA Bus Tracker and Train Tracker APIs every 15 seconds with in-memory caching
- **Smooth Marker Animation** — Turf.js dead-reckoning interpolation projects bus positions along their heading/speed between polls; trains use linear lerp
- **Static Route Shapes** — GTFS route geometries rendered as colored polylines on the map, each in the route's official CTA color
- **Per-Route Toggles** — Expandable overlay panel lets you show/hide individual bus and train routes, with bulk All/None controls
- **Layer Visibility** — Independent switches for bus vehicles, train vehicles, bus route lines, and train route lines
- **Cross-Platform** — Runs on Web, iOS, and Android via Expo
- **ETag Caching** — Static GeoJSON served with ETag/304 support and 24-hour Cache-Control headers

## Architecture

```
backend/
├── server.js                      Express entry point, CORS, GTFS preload
├── routes/
│   ├── api.js                     CTA proxy + legacy shape endpoints
│   └── staticData.js              Generated routes.geojson serving with ETag
├── services/
│   ├── ctaProxy.js                CTA Bus/Train API proxy with 15s cache
│   └── gtfsLoader.js              Runtime GTFS CSV → GeoJSON loader
├── scripts/
│   └── generateGeoJSON.js         Offline GTFS → optimized routes.geojson
└── data/
    ├── gtfs/                      Place GTFS .txt files here
    └── routes.geojson             Generated output

frontend/
├── App.tsx                        Root component
├── components/
│   ├── TransitMap.tsx             MapView with polling + interpolation
│   ├── VehicleMarker.tsx          Memoized per-vehicle marker
│   ├── RouteLayer.tsx             Per-route GeoJSON polylines
│   └── RouteToggleOverlay.tsx     Floating layer/route toggle panel
├── store/
│   └── transitStore.ts            Zustand store (vehicles, shapes, toggles)
├── services/
│   └── api.ts                     Typed fetch client with timeout handling
└── utils/
    └── interpolateMovement.ts     Turf.js dead-reckoning + lerp engine
```

## Prerequisites

- **Node.js** >= 18
- **CTA API Keys** — Register at [CTA Developer Center](https://www.transitchicago.com/developers/) for both Bus Tracker and Train Tracker keys
- **CTA GTFS Data** — Download the static GTFS feed from [CTA GTFS](https://www.transitchicago.com/developers/gtfs/) and extract into `backend/data/gtfs/`

## Setup

### 1. Clone and install dependencies

```bash
git clone <repo-url> && cd bus-tracker

# Backend
cd backend
npm install express cors axios node-cache dotenv
cd ..

# Frontend
cd frontend
npx create-expo-app@latest . --template blank-typescript  # if not already initialized
npm install zustand react-native-maps @turf/destination @turf/helpers
cd ..
```

### 2. Configure environment variables

Create `backend/.env`:

```env
CTA_BUS_API_KEY=your_bus_tracker_api_key
CTA_TRAIN_API_KEY=your_train_tracker_api_key
PORT=3001
```

For native mobile builds, create `frontend/.env`:

```env
EXPO_PUBLIC_API_URL=http://<your-lan-ip>:3001/api
```

Web builds proxy through same-origin (`/api`) automatically.

### 3. Generate route shapes from GTFS

Place the CTA GTFS files (`shapes.txt`, `routes.txt`, `trips.txt`) in `backend/data/gtfs/`, then run:

```bash
node backend/scripts/generateGeoJSON.js
```

This produces `backend/data/routes.geojson` — an optimized FeatureCollection with deduplicated shapes, route colors, and coordinates rounded to ~1m precision.

Optional flags:

```bash
node backend/scripts/generateGeoJSON.js --gtfs-dir /path/to/gtfs --out /path/to/output.geojson
```

### 4. Start the backend

```bash
cd backend
node server.js
```

The server starts on `http://localhost:3001`. Verify with:

```bash
curl http://localhost:3001/health
```

### 5. Start the frontend

```bash
cd frontend
npx expo start
```

Press `w` for web, `i` for iOS simulator, or `a` for Android emulator.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/buses/vehicles?routes=22,36,151` | Real-time bus positions (15s cache) |
| `GET` | `/api/trains/positions?routes=Red,Blue,Brn` | Real-time train positions (15s cache) |
| `GET` | `/api/buses/routes` | Available CTA bus routes (5min cache) |
| `GET` | `/api/shapes` | All GTFS shapes (runtime-loaded) |
| `GET` | `/api/shapes/:routeId` | Single route shape |
| `GET` | `/api/static/routes.geojson` | Pre-generated route shapes (ETag cached) |
| `GET` | `/api/static/routes` | Route metadata list for toggle UI |
| `GET` | `/api/static/routes/:routeId` | Single pre-generated route shape |
| `GET` | `/health` | Server health check |

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CTA_BUS_API_KEY` | Yes | — | CTA Bus Tracker API key |
| `CTA_TRAIN_API_KEY` | Yes | — | CTA Train Tracker API key |
| `PORT` | No | `3001` | Backend server port |
| `GTFS_DIR` | No | `backend/data/gtfs` | Path to GTFS `.txt` files |
| `ROUTES_GEOJSON_PATH` | No | `backend/data/routes.geojson` | Path to generated GeoJSON |
| `EXPO_PUBLIC_API_URL` | No | `http://localhost:3001/api` | API base URL for native builds |
