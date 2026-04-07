import React, { useEffect, useMemo, useRef } from "react";
import { StyleSheet, View, Text } from "react-native";
import MapView, { Geojson, Region } from "react-native-maps";
import { useTransitStore } from "../store/transitStore";
import VehicleMarker from "./VehicleMarker";
import type { GeoJSONFeatureCollection } from "../services/api";

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
// Component
// ---------------------------------------------------------------------------

export default function TransitMap() {
  const mapRef = useRef<MapView>(null);
  const vehicles = useTransitStore((s) => s.vehicles);
  const shapes = useTransitStore((s) => s.shapes);
  const error = useTransitStore((s) => s.error);
  const startPolling = useTransitStore((s) => s.startPolling);

  const showBusRoutes = useTransitStore((s) => s.showBusRoutes);
  const showTrainRoutes = useTransitStore((s) => s.showTrainRoutes);
  const showBusVehicles = useTransitStore((s) => s.showBusVehicles);
  const showTrainVehicles = useTransitStore((s) => s.showTrainVehicles);

  // ---- lifecycle ----------------------------------------------------------

  useEffect(() => {
    const cleanup = startPolling();
    return cleanup;
  }, [startPolling]);

  // ---- derived data -------------------------------------------------------

  const visibleVehicles = useMemo(
    () =>
      vehicles.filter((v) =>
        v.type === "bus" ? showBusVehicles : showTrainVehicles
      ),
    [vehicles, showBusVehicles, showTrainVehicles]
  );

  // Split shapes into bus / train collections so toggles work independently
  const busShapes = useMemo<GeoJSONFeatureCollection | null>(() => {
    if (!shapes || !showBusRoutes) return null;
    const features = shapes.features.filter(
      (f) => f.properties.route_type !== "rail"
    );
    return features.length ? { type: "FeatureCollection", features } : null;
  }, [shapes, showBusRoutes]);

  const trainShapes = useMemo<GeoJSONFeatureCollection | null>(() => {
    if (!shapes || !showTrainRoutes) return null;
    const features = shapes.features.filter(
      (f) => f.properties.route_type === "rail"
    );
    return features.length ? { type: "FeatureCollection", features } : null;
  }, [shapes, showTrainRoutes]);

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
        {busShapes && (
          <Geojson
            geojson={busShapes as any}
            strokeColor="#66bb6a"
            strokeWidth={2}
          />
        )}

        {trainShapes && (
          <Geojson
            geojson={trainShapes as any}
            strokeColor="#42a5f5"
            strokeWidth={3}
          />
        )}

        {visibleVehicles.map((v) => (
          <VehicleMarker key={v.id} vehicle={v} />
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
