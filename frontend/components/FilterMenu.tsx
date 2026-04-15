import React, { useMemo, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { useTransitStore } from "../store/transitStore";
import type { RouteInfo } from "../services/api";

// ---------------------------------------------------------------------------
// Floating top-left filter menu
// Two tabs (Bus / Train) each containing a checkbox list of routes.
// ---------------------------------------------------------------------------

type TabKey = "bus" | "rail";

export default function FilterMenu() {
  const [activeTab, setActiveTab] = useState<TabKey>("bus");
  const [collapsed, setCollapsed] = useState(false);

  const availableRoutes = useTransitStore((s) => s.availableRoutes);
  const selectedRoutes = useTransitStore((s) => s.selectedRoutes);
  const toggleRoute = useTransitStore((s) => s.toggleRoute);
  const selectAllOfType = useTransitStore((s) => s.selectAllOfType);
  const clearAllOfType = useTransitStore((s) => s.clearAllOfType);
  const loading = useTransitStore((s) => s.loading);
  const vehicleCount = useTransitStore((s) => s.vehicles.length);

  const selectedSet = useMemo(() => new Set(selectedRoutes), [selectedRoutes]);

  const { busRoutes, railRoutes } = useMemo(() => {
    const bus: RouteInfo[] = [];
    const rail: RouteInfo[] = [];
    for (const r of availableRoutes) {
      if (r.route_type === "rail") rail.push(r);
      else bus.push(r);
    }
    // Sort buses numerically when possible, rail by long name
    bus.sort((a, b) => {
      const an = parseInt(a.route_short_name, 10);
      const bn = parseInt(b.route_short_name, 10);
      if (!isNaN(an) && !isNaN(bn)) return an - bn;
      return a.route_short_name.localeCompare(b.route_short_name);
    });
    rail.sort((a, b) => a.route_long_name.localeCompare(b.route_long_name));
    return { busRoutes: bus, railRoutes: rail };
  }, [availableRoutes]);

  const rows = activeTab === "bus" ? busRoutes : railRoutes;

  return (
    <View style={styles.container} pointerEvents="box-none">
      <View style={styles.panel}>
        {/* ---- Header ---- */}
        <TouchableOpacity
          style={styles.header}
          onPress={() => setCollapsed((v) => !v)}
          activeOpacity={0.7}
        >
          <Text style={styles.headerTitle}>CTA Filters</Text>
          <Text style={styles.chevron}>{collapsed ? "\u25BC" : "\u25B2"}</Text>
        </TouchableOpacity>

        {!collapsed && (
          <>
            {/* ---- Tabs ---- */}
            <View style={styles.tabBar}>
              <TabButton
                label="Bus"
                active={activeTab === "bus"}
                onPress={() => setActiveTab("bus")}
              />
              <TabButton
                label="Train"
                active={activeTab === "rail"}
                onPress={() => setActiveTab("rail")}
              />
            </View>

            {/* ---- Bulk actions ---- */}
            <View style={styles.bulkRow}>
              <TouchableOpacity onPress={() => selectAllOfType(activeTab)}>
                <Text style={styles.bulkBtn}>Select all</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => clearAllOfType(activeTab)}>
                <Text style={styles.bulkBtn}>Clear</Text>
              </TouchableOpacity>
            </View>

            {/* ---- Route list ---- */}
            {availableRoutes.length === 0 ? (
              <Text style={styles.empty}>Loading routes…</Text>
            ) : (
              <ScrollView
                style={styles.routeList}
                nestedScrollEnabled
                showsVerticalScrollIndicator
              >
                {rows.map((r) => {
                  const checked = selectedSet.has(r.route_id);
                  return (
                    <TouchableOpacity
                      key={r.route_id}
                      style={styles.routeRow}
                      onPress={() => toggleRoute(r.route_id)}
                      activeOpacity={0.6}
                    >
                      <View
                        style={[
                          styles.checkbox,
                          checked && styles.checkboxChecked,
                        ]}
                      >
                        {checked && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                      <View
                        style={[
                          styles.swatch,
                          { backgroundColor: r.route_color || "#888" },
                        ]}
                      />
                      <Text style={styles.routeLabel} numberOfLines={1}>
                        {activeTab === "bus"
                          ? `${r.route_short_name}  ${r.route_long_name}`
                          : r.route_long_name || r.route_short_name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {/* ---- Status ---- */}
            <View style={styles.statusRow}>
              <Text style={styles.status}>
                {loading
                  ? "Updating…"
                  : selectedRoutes.length === 0
                  ? "No routes selected"
                  : `${selectedRoutes.length} routes · ${vehicleCount} vehicles`}
              </Text>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface TabButtonProps {
  label: string;
  active: boolean;
  onPress: () => void;
}

function TabButton({ label, active, onPress }: TabButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.tab, active && styles.tabActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.tabText, active && styles.tabTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 12,
    left: 12,
    zIndex: 30,
    maxHeight: "85%",
  },
  panel: {
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
    width: 260,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 6,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#212121",
  },
  chevron: {
    fontSize: 12,
    color: "#757575",
  },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    marginBottom: 6,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: "#1565c0",
  },
  tabText: {
    fontSize: 13,
    color: "#757575",
    fontWeight: "600",
  },
  tabTextActive: {
    color: "#1565c0",
  },
  bulkRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  bulkBtn: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1565c0",
  },
  routeList: {
    maxHeight: 320,
    marginTop: 4,
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 3,
    borderWidth: 1.5,
    borderColor: "#9e9e9e",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  checkboxChecked: {
    backgroundColor: "#1565c0",
    borderColor: "#1565c0",
  },
  checkmark: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 14,
  },
  swatch: {
    width: 14,
    height: 14,
    borderRadius: 3,
    marginRight: 8,
  },
  routeLabel: {
    flex: 1,
    fontSize: 12,
    color: "#212121",
  },
  empty: {
    fontSize: 12,
    color: "#9e9e9e",
    textAlign: "center",
    paddingVertical: 12,
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
