import React, { useEffect, useMemo, useRef, useState } from "react";
// @ts-expect-error react-map-gl subpath export
import Map, { Marker, Popup, Source, Layer } from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";
import { useTransitStore } from "../store/transitStore";
import type { InterpolatedVehicle } from "../utils/interpolateMovement";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CHICAGO = {
  longitude: -87.6298,
  latitude: 41.8781,
  zoom: 11,
};

// OpenFreeMap — free, no API key, no attribution fuss
const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

// Keyed by lowercased variants so case + alias (full name, short code,
// GTFS code) all resolve to the same brand color.
const TRAIN_COLORS: Record<string, string> = {
  red: "#c62828",
  blue: "#1565c0",
  brn: "#6d4c41",
  brown: "#6d4c41",
  g: "#2e7d32",
  grn: "#2e7d32",
  green: "#2e7d32",
  org: "#ef6c00",
  orange: "#ef6c00",
  p: "#6a1b9a",
  pur: "#6a1b9a",
  purple: "#6a1b9a",
  pink: "#e91e63",
  pnk: "#e91e63",
  y: "#f9a825",
  yellow: "#f9a825",
};

const TRAIN_LINE_NAMES: Record<string, string> = {
  red: "Red Line",
  blue: "Blue Line",
  brn: "Brown Line",
  brown: "Brown Line",
  g: "Green Line",
  grn: "Green Line",
  green: "Green Line",
  org: "Orange Line",
  orange: "Orange Line",
  p: "Purple Line",
  pur: "Purple Line",
  purple: "Purple Line",
  pink: "Pink Line",
  pnk: "Pink Line",
  y: "Yellow Line",
  yellow: "Yellow Line",
};

function vehicleLabel(v: InterpolatedVehicle): string {
  if (v.type === "train") {
    const key = (v.route || "").toLowerCase().trim();
    const line = TRAIN_LINE_NAMES[key] ?? `${v.route} Line`;
    return `Train · ${line} · ${v.destination}`;
  }
  return `Bus · ${v.route} · ${v.destination}`;
}

const LOGGED_UNKNOWN = new Set<string>();
function vehicleColor(v: InterpolatedVehicle): string {
  if (v.type === "train") {
    const key = (v.route || "").toLowerCase().trim();
    const color = TRAIN_COLORS[key];
    if (color) return color;
    if (!LOGGED_UNKNOWN.has(key)) {
      LOGGED_UNKNOWN.add(key);
      console.warn("[TransitMap] unknown train route code:", v.route);
    }
    return "#333";
  }
  return "#1b5e20";
}

const HIT_BOX = 44; // Apple HIG min touch target
const ICON_SIZE = 28;
const POPUP_GRACE_MS = 150;

// ---------------------------------------------------------------------------
// MapLibre CSS injection (avoids Metro CSS-loader dependency)
// ---------------------------------------------------------------------------

function useMaplibreCss() {
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (document.getElementById("maplibre-css")) return;
    const link = document.createElement("link");
    link.id = "maplibre-css";
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css";
    document.head.appendChild(link);
  }, []);
}

// ---------------------------------------------------------------------------
// Directional SVG marker
// ---------------------------------------------------------------------------

interface MarkerIconProps {
  vehicle: InterpolatedVehicle;
}

function VehicleIcon({ vehicle: v }: MarkerIconProps) {
  const fill = vehicleColor(v);
  // Chevron/teardrop: pointed tip up (north), wide base. Rotation handled
  // by parent transform so heading=0 means tip pointing north.
  return (
    <svg
      width={ICON_SIZE}
      height={ICON_SIZE}
      viewBox="0 0 32 32"
      style={{
        display: "block",
        filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.5))",
      }}
    >
      <path
        d="M16 2 L28 28 L16 22 L4 28 Z"
        fill={fill}
        stroke="#ffffff"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {v.type === "bus" ? (
        <text
          x={16}
          y={20}
          textAnchor="middle"
          fontSize={9}
          fontWeight={700}
          fill="#ffffff"
          fontFamily="system-ui, sans-serif"
        >
          {v.route}
        </text>
      ) : (
        <circle cx={16} cy={17} r={2.4} fill="#ffffff" />
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TransitMap() {
  useMaplibreCss();

  const vehicles = useTransitStore((s) => s.vehicles);
  const routeShapes = useTransitStore((s) => s.routeShapes);
  const selectedRoutes = useTransitStore((s) => s.selectedRoutes);
  const error = useTransitStore((s) => s.error);
  const startPolling = useTransitStore((s) => s.startPolling);
  const showBusVehicles = useTransitStore((s) => s.showBusVehicles);
  const showTrainVehicles = useTransitStore((s) => s.showTrainVehicles);
  const showBusRoutes = useTransitStore((s) => s.showBusRoutes);
  const showTrainRoutes = useTransitStore((s) => s.showTrainRoutes);

  // Hover state for the popup
  const [hovered, setHovered] = useState<InterpolatedVehicle | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function openPopup(v: InterpolatedVehicle) {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setHovered(v);
  }

  function schedulePopupClose() {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      setHovered(null);
      closeTimerRef.current = null;
    }, POPUP_GRACE_MS);
  }

  // ---- lifecycle ---------------------------------------------------------

  useEffect(() => {
    const cleanup = startPolling();
    return cleanup;
  }, [startPolling]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  // ---- filtered vehicles -------------------------------------------------

  const visibleVehicles = useMemo(
    () =>
      vehicles.filter((v) =>
        v.type === "bus" ? showBusVehicles : showTrainVehicles
      ),
    [vehicles, showBusVehicles, showTrainVehicles]
  );

  // ---- filtered route shapes ---------------------------------------------

  const filteredShapes = useMemo(() => {
    if (!routeShapes || selectedRoutes.length === 0) return null;
    const selected = new Set(selectedRoutes);

    const features = routeShapes.features.filter((f) => {
      const routeType = (f.properties as any).route_type as string;
      const rid = (f.properties as any).route_id as string;
      if (!selected.has(rid)) return false;
      if (routeType === "rail" && !showTrainRoutes) return false;
      if (routeType !== "rail" && !showBusRoutes) return false;
      return true;
    });

    return features.length
      ? { type: "FeatureCollection" as const, features }
      : null;
  }, [routeShapes, selectedRoutes, showBusRoutes, showTrainRoutes]);

  // ---- render ------------------------------------------------------------

  return (
    <div style={styles.root}>
      {error && <div style={styles.errorBanner}>{error}</div>}

      <Map
        mapLib={maplibregl as any}
        initialViewState={CHICAGO}
        style={{ width: "100%", height: "100%" }}
        mapStyle={MAP_STYLE}
      >
        {filteredShapes && (
          <Source id="routes" type="geojson" data={filteredShapes as any}>
            <Layer
              id="routes-line"
              type="line"
              paint={{
                "line-color": ["coalesce", ["get", "route_color"], "#888"],
                "line-width": 3,
                "line-opacity": 0.85,
              }}
              layout={{
                "line-cap": "round",
                "line-join": "round",
              }}
            />
          </Source>
        )}

        {visibleVehicles.map((v) => (
          <Marker
            key={v.id}
            longitude={v.displayLon}
            latitude={v.displayLat}
            anchor="center"
          >
            {/*
              44×44 transparent hit box for easy hover; visible icon centred
              inside and rotated according to displayHeading.
            */}
            <div
              onMouseEnter={() => openPopup(v)}
              onMouseLeave={schedulePopupClose}
              style={styles.hitBox}
            >
              <div
                style={{
                  ...styles.iconWrap,
                  transform: `rotate(${v.displayHeading || 0}deg)`,
                }}
              >
                <VehicleIcon vehicle={v} />
              </div>
            </div>
          </Marker>
        ))}

        {hovered && (
          <Popup
            longitude={hovered.displayLon}
            latitude={hovered.displayLat}
            anchor="bottom"
            offset={24}
            closeButton={false}
            closeOnClick={false}
            onClose={() => setHovered(null)}
          >
            <div
              onMouseEnter={() => openPopup(hovered)}
              onMouseLeave={schedulePopupClose}
              style={styles.popupBody}
            >
              <div style={styles.popupTitle}>{vehicleLabel(hovered)}</div>
              <div style={styles.popupRow}>ID: {hovered.id}</div>
              <div style={styles.popupRow}>
                {Math.round(hovered.speed)} mph · updated{" "}
                {secondsAgo(hovered.timestamp)}s ago
              </div>
            </div>
          </Popup>
        )}
      </Map>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function secondsAgo(ts: string): number {
  const t = Date.parse(ts);
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.round((Date.now() - t) / 1000));
}

// ---------------------------------------------------------------------------
// Styles (plain objects – this is a DOM component, not react-native)
// ---------------------------------------------------------------------------

const styles: Record<string, React.CSSProperties> = {
  root: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  errorBanner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    background: "#d32f2f",
    color: "#fff",
    padding: 8,
    textAlign: "center",
    fontSize: 13,
    fontFamily: "system-ui, sans-serif",
  },
  hitBox: {
    width: HIT_BOX,
    height: HIT_BOX,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    // Transparent — only the inner SVG is visible.
    background: "transparent",
  },
  iconWrap: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    transformOrigin: "50% 50%",
    transition: "transform 200ms linear",
  },
  popupBody: {
    fontFamily: "system-ui, sans-serif",
    fontSize: 12,
    color: "#212121",
    minWidth: 160,
  },
  popupTitle: {
    fontWeight: 700,
    fontSize: 13,
    marginBottom: 4,
  },
  popupRow: {
    lineHeight: "16px",
  },
};
