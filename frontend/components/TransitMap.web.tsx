import React, { useEffect, useMemo } from "react";
// @ts-expect-error react-map-gl subpath export
import Map, { Marker, Source, Layer } from "react-map-gl/maplibre";
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

const TRAIN_COLORS: Record<string, string> = {
  Red: "#c62828",
  Blue: "#1565c0",
  Brn: "#6d4c41",
  G: "#2e7d32",
  Org: "#ef6c00",
  P: "#6a1b9a",
  Pink: "#e91e63",
  Y: "#f9a825",
};

function markerColor(v: InterpolatedVehicle): string {
  if (v.type === "train") return TRAIN_COLORS[v.route] ?? "#333";
  return "#1b5e20";
}

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

  // ---- lifecycle ---------------------------------------------------------

  useEffect(() => {
    const cleanup = startPolling();
    return cleanup;
  }, [startPolling]);

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
    if (!routeShapes) return null;
    const selected = selectedRoutes ? new Set(selectedRoutes) : null;

    const features = routeShapes.features.filter((f) => {
      const routeType = (f.properties as any).route_type as string;
      if (routeType === "rail" && !showTrainRoutes) return false;
      if (routeType !== "rail" && !showBusRoutes) return false;
      if (selected) {
        const rid = (f.properties as any).route_id as string;
        if (!selected.has(rid)) return false;
      }
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
            <div
              title={`${v.type === "bus" ? "Bus" : "Train"} ${v.route} → ${v.destination}`}
              style={{
                ...styles.vehicleDot,
                background: markerColor(v),
              }}
            />
          </Marker>
        ))}
      </Map>
    </div>
  );
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
  vehicleDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    border: "2px solid #fff",
    boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
    cursor: "pointer",
  },
};
