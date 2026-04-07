import React from "react";
import { Marker } from "react-native-maps";
import type { InterpolatedVehicle } from "../utils/interpolateMovement";

// ---------------------------------------------------------------------------
// Marker colors
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
  return "#1b5e20";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  vehicle: InterpolatedVehicle;
}

const VehicleMarker = React.memo(function VehicleMarker({ vehicle: v }: Props) {
  return (
    <Marker
      coordinate={{ latitude: v.displayLat, longitude: v.displayLon }}
      title={`${v.type === "bus" ? "Bus" : "Train"} ${v.route}`}
      description={`→ ${v.destination}  |  ${Math.round(v.speed)} mph`}
      pinColor={markerColor(v)}
      rotation={v.heading}
      anchor={{ x: 0.5, y: 0.5 }}
      flat
      tracksViewChanges={false}
    />
  );
});

export default VehicleMarker;
