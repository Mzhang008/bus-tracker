import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  Switch,
  TouchableOpacity,
  ScrollView,
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

const LAYER_ROWS: RowDef[] = [
  { key: "showBusVehicles", label: "Bus vehicles", color: "#1b5e20" },
  { key: "showTrainVehicles", label: "Train vehicles", color: "#1565c0" },
  { key: "showBusRoutes", label: "Bus routes", color: "#66bb6a" },
  { key: "showTrainRoutes", label: "Train routes", color: "#42a5f5" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RouteToggleOverlay() {
  const [expanded, setExpanded] = useState(false);

  const toggleLayer = useTransitStore((s) => s.toggleLayer);
  const showBusRoutes = useTransitStore((s) => s.showBusRoutes);
  const showTrainRoutes = useTransitStore((s) => s.showTrainRoutes);
  const showBusVehicles = useTransitStore((s) => s.showBusVehicles);
  const showTrainVehicles = useTransitStore((s) => s.showTrainVehicles);
  const loading = useTransitStore((s) => s.loading);
  const vehicleCount = useTransitStore((s) => s.vehicles.length);

  const availableRoutes = useTransitStore((s) => s.availableRoutes);
  const selectedRoutes = useTransitStore((s) => s.selectedRoutes);
  const toggleRoute = useTransitStore((s) => s.toggleRoute);
  const selectAllRoutes = useTransitStore((s) => s.selectAllRoutes);
  const deselectAllRoutes = useTransitStore((s) => s.deselectAllRoutes);

  const layerValues: Record<LayerKey, boolean> = {
    showBusRoutes,
    showTrainRoutes,
    showBusVehicles,
    showTrainVehicles,
  };

  function isRouteSelected(routeId: string): boolean {
    return selectedRoutes === null || selectedRoutes.includes(routeId);
  }

  return (
    <View style={styles.container} pointerEvents="box-none">
      <View style={styles.panel}>
        <Text style={styles.title}>Layers</Text>

        {LAYER_ROWS.map((row) => (
          <View key={row.key} style={styles.row}>
            <View style={[styles.dot, { backgroundColor: row.color }]} />
            <Text style={styles.label}>{row.label}</Text>
            <Switch
              value={layerValues[row.key]}
              onValueChange={() => toggleLayer(row.key)}
              trackColor={{ false: "#ccc", true: row.color }}
              thumbColor={Platform.OS === "android" ? "#fff" : undefined}
            />
          </View>
        ))}

        {/* ---- Per-route toggles ---- */}
        {availableRoutes.length > 0 && (
          <>
            <View style={styles.divider} />

            <TouchableOpacity
              onPress={() => setExpanded((v) => !v)}
              style={styles.sectionHeader}
            >
              <Text style={styles.title}>
                Routes {expanded ? "\u25B2" : "\u25BC"}
              </Text>
            </TouchableOpacity>

            {expanded && (
              <>
                <View style={styles.bulkRow}>
                  <TouchableOpacity onPress={selectAllRoutes}>
                    <Text style={styles.bulkBtn}>All</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={deselectAllRoutes}>
                    <Text style={styles.bulkBtn}>None</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.routeList} nestedScrollEnabled>
                  {availableRoutes.map((r) => (
                    <TouchableOpacity
                      key={r.route_id}
                      style={styles.routeRow}
                      onPress={() => toggleRoute(r.route_id)}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          styles.routeChip,
                          {
                            backgroundColor: isRouteSelected(r.route_id)
                              ? r.route_color
                              : "#e0e0e0",
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.routeChipText,
                            {
                              color: isRouteSelected(r.route_id)
                                ? "#fff"
                                : "#999",
                            },
                          ]}
                        >
                          {r.route_short_name}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.routeName,
                          !isRouteSelected(r.route_id) && styles.routeNameDim,
                        ]}
                        numberOfLines={1}
                      >
                        {r.route_long_name || r.route_short_name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}
          </>
        )}

        {/* ---- Status ---- */}
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
    maxHeight: "80%",
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
    minWidth: 200,
    maxWidth: 260,
  },
  title: {
    fontWeight: "700",
    fontSize: 14,
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
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#e0e0e0",
    marginVertical: 6,
  },
  sectionHeader: {
    paddingVertical: 4,
  },
  bulkRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 4,
  },
  bulkBtn: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1565c0",
  },
  routeList: {
    maxHeight: 220,
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 3,
  },
  routeChip: {
    width: 36,
    height: 22,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  routeChipText: {
    fontSize: 11,
    fontWeight: "700",
  },
  routeName: {
    flex: 1,
    fontSize: 12,
    color: "#424242",
  },
  routeNameDim: {
    color: "#bdbdbd",
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
