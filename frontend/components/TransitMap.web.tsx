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

// ---------------------------------------------------------------------------
// Train line registry — single source of truth for color + display name.
// resolveLine() handles every case variant, alias, and short-code we've
// seen from the CTA Train Tracker feed.
// ---------------------------------------------------------------------------

interface LineDef {
  canonical: string; // "Red", "Brown", ...
  color: string;
  aliases: string[];
}

const LINES: LineDef[] = [
  { canonical: "Red", color: "#c62828", aliases: ["red", "r"] },
  { canonical: "Blue", color: "#1565c0", aliases: ["blue", "bl"] },
  { canonical: "Brown", color: "#6d4c41", aliases: ["brn", "brown", "br"] },
  { canonical: "Green", color: "#2e7d32", aliases: ["g", "grn", "green", "gr"] },
  { canonical: "Orange", color: "#ef6c00", aliases: ["org", "orange", "o"] },
  { canonical: "Purple", color: "#6a1b9a", aliases: ["p", "pur", "purp", "purple"] },
  { canonical: "Pink", color: "#e91e63", aliases: ["pink", "pnk", "pk"] },
  { canonical: "Yellow", color: "#f9a825", aliases: ["y", "yel", "yellow"] },
];

const LINE_BY_ALIAS: Record<string, LineDef> = {};
for (const def of LINES) {
  for (const a of def.aliases) LINE_BY_ALIAS[a] = def;
  LINE_BY_ALIAS[def.canonical.toLowerCase()] = def;
}

function normaliseKey(s: string | undefined | null): string {
  return (s ?? "").toLowerCase().replace(/[^a-z]/g, "").trim();
}

interface ResolvedLine {
  color: string;
  name: string; // e.g. "Purple Line"
  key: string; // normalised input
}

const LOGGED_UNKNOWN = new Set<string>();

function resolveLine(route: string | undefined | null): ResolvedLine | null {
  const key = normaliseKey(route);
  if (!key) return null;

  // 1. Exact alias or canonical match
  const exact = LINE_BY_ALIAS[key];
  if (exact) return { color: exact.color, name: `${exact.canonical} Line`, key };

  // 2. startsWith match (handles "purpleexp", "grn2", etc.)
  for (const def of LINES) {
    if (
      key.startsWith(def.canonical.toLowerCase()) ||
      def.aliases.some((a) => a.length > 1 && key.startsWith(a))
    ) {
      return { color: def.color, name: `${def.canonical} Line`, key };
    }
  }

  // 3. Single-letter fallback (disambiguate b → Blue vs Brown by checking
  //    the next char if present)
  if (key.length === 1) {
    const letterMap: Record<string, string> = {
      r: "Red",
      b: "Blue",
      g: "Green",
      o: "Orange",
      p: "Purple",
      y: "Yellow",
    };
    const canon = letterMap[key];
    if (canon) {
      const def = LINES.find((l) => l.canonical === canon)!;
      return { color: def.color, name: `${def.canonical} Line`, key };
    }
  }

  // 4. Unknown — log once and fall through to the caller's default.
  if (!LOGGED_UNKNOWN.has(key)) {
    LOGGED_UNKNOWN.add(key);
    console.warn("[TransitMap] unknown train route code:", route);
  }
  return null;
}

function vehicleLabel(v: InterpolatedVehicle): string {
  if (v.type === "train") {
    const line = resolveLine(v.route);
    const name = line ? line.name : `${v.route ?? "?"} Line`;
    return `Train · ${name} · ${v.destination}`;
  }
  return `Bus · ${v.route} · ${v.destination}`;
}

function vehicleColor(v: InterpolatedVehicle): string {
  if (v.type === "train") {
    const line = resolveLine(v.route);
    return line?.color ?? "#555";
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

  // Current map zoom — drives the marker scale factor.
  const [zoom, setZoom] = useState<number>(CHICAGO.zoom);
  const markerScale = useMemo(() => {
    // Linear ramp: zoom 10 → 0.6, zoom 13 → 1.0, zoom 16 → 1.8
    const s = 0.6 + (zoom - 10) * 0.2;
    return Math.max(0.6, Math.min(1.8, s));
  }, [zoom]);

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
        onMove={(e: any) => setZoom(e.viewState.zoom)}
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
              Outer wrapper is scaled by current map zoom (hit box + icon
              stay proportional). Inner wrapper handles heading rotation.
            */}
            <div
              onMouseEnter={() => openPopup(v)}
              onMouseLeave={schedulePopupClose}
              style={{
                ...styles.hitBox,
                transform: `scale(${markerScale})`,
                transition: "transform 150ms linear",
              }}
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
}
