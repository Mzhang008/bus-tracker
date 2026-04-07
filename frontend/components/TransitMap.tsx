import React, { useEffect, useRef } from "react";
import { StyleSheet, View, Text } from "react-native";
import MapView, { Marker, Geojson, Region } from "react-native-maps";
import type { InterpolatedVehicle } from "../utils/interpolateMovement";
import { useTransitStore } from "../store/transitStore";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CHICAGO_CENTER: Region = {
  latitude: 41.8781,
  longitude: -87.6298,
  latitudeDelta: 0.15,
  longitudeDelta: 0.15,
};

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
  const vehicles = useTransitStore((s) => s.vehicles);
  const shapes = useTransitStore((s) => s.shapes);
  const error = useTransitStore((s) => s.error);
  const startPolling = useTransitStore((s) => s.startPolling);

  // ---- lifecycle ----------------------------------------------------------

  useEffect(() => {
    const cleanup = startPolling();
    return cleanup;
  }, [startPolling]);

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
        {shapes && (
          <Geojson
            geojson={shapes as any}
            strokeColor="#1565c0"
            strokeWidth={2}
          />
        )}

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
