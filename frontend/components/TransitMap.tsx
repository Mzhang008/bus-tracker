import React, { useEffect, useRef, useState, useCallback } from "react";
import { StyleSheet, View, Text, Platform } from "react-native";
import MapView, { Marker, Region } from "react-native-maps";
import {
  VehiclePosition,
  InterpolatedVehicle,
  updateVehiclePositions,
  getInterpolatedPositions,
} from "../utils/interpolateMovement";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CHICAGO_CENTER: Region = {
  latitude: 41.8781,
  longitude: -87.6298,
  latitudeDelta: 0.15,
  longitudeDelta: 0.15,
};

const POLL_MS = 15_000;
const FRAME_MS = 1_000; // interpolation refresh rate

const API_BASE =
  Platform.OS === "web" ? "/api" : process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001/api";

const BUS_ROUTES = "22,36,151"; // default watched bus routes
const TRAIN_ROUTES = "Red,Blue,Brn"; // default watched train lines

// ---------------------------------------------------------------------------
// Marker colors per route type
// ---------------------------------------------------------------------------

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
  return "#1b5e20"; // buses
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TransitMap() {
  const mapRef = useRef<MapView>(null);
  const [vehicles, setVehicles] = useState<InterpolatedVehicle[]>([]);
  const [error, setError] = useState<string | null>(null);

  // ---- data fetching ------------------------------------------------------

  const fetchVehicles = useCallback(async () => {
    try {
      const [busRes, trainRes] = await Promise.all([
        fetch(`${API_BASE}/buses/vehicles?routes=${BUS_ROUTES}`),
        fetch(`${API_BASE}/trains/positions?routes=${TRAIN_ROUTES}`),
      ]);

      if (!busRes.ok || !trainRes.ok) {
        throw new Error(`HTTP ${busRes.status} / ${trainRes.status}`);
      }

      const [busData, trainData] = await Promise.all([busRes.json(), trainRes.json()]);
      const all: VehiclePosition[] = [...busData.vehicles, ...trainData.vehicles];

      updateVehiclePositions(all);
      setVehicles(getInterpolatedPositions());
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Fetch failed");
    }
  }, []);

  // ---- lifecycle ----------------------------------------------------------

  useEffect(() => {
    fetchVehicles();
    const poll = setInterval(fetchVehicles, POLL_MS);
    return () => clearInterval(poll);
  }, [fetchVehicles]);

  // Interpolation tick – runs between polls to animate markers
  useEffect(() => {
    const tick = setInterval(() => {
      setVehicles(getInterpolatedPositions());
    }, FRAME_MS);
    return () => clearInterval(tick);
  }, []);

  // ---- render -------------------------------------------------------------

  return (
    <View style={styles.container}>
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={CHICAGO_CENTER}
        showsUserLocation
        showsMyLocationButton
      >
        {vehicles.map((v) => (
          <Marker
            key={v.id}
            coordinate={{ latitude: v.displayLat, longitude: v.displayLon }}
            title={`${v.type === "bus" ? "Bus" : "Train"} ${v.route}`}
            description={`→ ${v.destination}  |  ${Math.round(v.speed)} mph`}
            pinColor={markerColor(v)}
            rotation={v.heading}
            anchor={{ x: 0.5, y: 0.5 }}
            flat
          />
        ))}
      </MapView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  errorBanner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: "#d32f2f",
    padding: 8,
  },
  errorText: { color: "#fff", textAlign: "center", fontSize: 13 },
});
