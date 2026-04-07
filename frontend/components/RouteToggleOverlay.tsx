import React from "react";
import {
  StyleSheet,
  View,
  Text,
  Switch,
  Platform,
} from "react-native";
import { useTransitStore } from "../store/transitStore";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LayerKey =
  | "showBusRoutes"
  | "showTrainRoutes"
  | "showBusVehicles"
  | "showTrainVehicles";

interface RowDef {
  key: LayerKey;
  label: string;
  color: string;
}

const ROWS: RowDef[] = [
  { key: "showBusVehicles", label: "Bus vehicles", color: "#1b5e20" },
  { key: "showTrainVehicles", label: "Train vehicles", color: "#1565c0" },
  { key: "showBusRoutes", label: "Bus routes", color: "#66bb6a" },
  { key: "showTrainRoutes", label: "Train routes", color: "#42a5f5" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RouteToggleOverlay() {
  const toggleLayer = useTransitStore((s) => s.toggleLayer);
  const showBusRoutes = useTransitStore((s) => s.showBusRoutes);
  const showTrainRoutes = useTransitStore((s) => s.showTrainRoutes);
  const showBusVehicles = useTransitStore((s) => s.showBusVehicles);
  const showTrainVehicles = useTransitStore((s) => s.showTrainVehicles);
  const loading = useTransitStore((s) => s.loading);
  const vehicleCount = useTransitStore((s) => s.vehicles.length);

  const values: Record<LayerKey, boolean> = {
    showBusRoutes,
    showTrainRoutes,
    showBusVehicles,
    showTrainVehicles,
  };

  return (
    <View style={styles.container} pointerEvents="box-none">
      <View style={styles.panel}>
        <Text style={styles.title}>Layers</Text>

        {ROWS.map((row) => (
          <View key={row.key} style={styles.row}>
            <View style={[styles.dot, { backgroundColor: row.color }]} />
            <Text style={styles.label}>{row.label}</Text>
            <Switch
              value={values[row.key]}
              onValueChange={() => toggleLayer(row.key)}
              trackColor={{ false: "#ccc", true: row.color }}
              thumbColor={Platform.OS === "android" ? "#fff" : undefined}
            />
          </View>
        ))}

        <View style={styles.statusRow}>
          <Text style={styles.status}>
            {loading ? "Updating..." : `${vehicleCount} vehicles`}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 48,
    right: 12,
    zIndex: 20,
  },
  panel: {
    backgroundColor: "rgba(255,255,255,0.93)",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
    minWidth: 180,
  },
  title: {
    fontWeight: "700",
    fontSize: 14,
    marginBottom: 6,
    color: "#212121",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  label: {
    flex: 1,
    fontSize: 13,
    color: "#424242",
  },
  statusRow: {
    marginTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e0e0e0",
    paddingTop: 6,
  },
  status: {
    fontSize: 11,
    color: "#757575",
    textAlign: "center",
  },
});
