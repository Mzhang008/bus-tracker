import React from "react";
import { StyleSheet, View, Text } from "react-native";
import { Marker, Callout } from "react-native-maps";
import Svg, { Path, Circle, Text as SvgText } from "react-native-svg";
import type { InterpolatedVehicle } from "../utils/interpolateMovement";

// ---------------------------------------------------------------------------
// Marker colors
// ---------------------------------------------------------------------------

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

function vehicleColor(v: InterpolatedVehicle): string {
  if (v.type === "train") {
    const key = (v.route || "").toLowerCase().trim();
    return TRAIN_COLORS[key] ?? "#333";
  }
  return "#1b5e20";
}

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const HIT_BOX = 44; // Apple HIG min touch target
const ICON_SIZE = 32;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  vehicle: InterpolatedVehicle;
}

const VehicleMarker = React.memo(function VehicleMarker({ vehicle: v }: Props) {
  const fill = vehicleColor(v);

  return (
    <Marker
      coordinate={{ latitude: v.displayLat, longitude: v.displayLon }}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={false}
    >
      {/* Transparent 44×44 hit area; rotated SVG icon centred inside. */}
      <View style={styles.hitBox}>
        <View
          style={[
            styles.iconWrap,
            { transform: [{ rotate: `${v.displayHeading || 0}deg` }] },
          ]}
        >
          <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 32 32">
            <Path
              d="M16 2 L28 28 L16 22 L4 28 Z"
              fill={fill}
              stroke="#ffffff"
              strokeWidth={2}
              strokeLinejoin="round"
            />
            {v.type === "bus" ? (
              <SvgText
                x={16}
                y={20}
                textAnchor="middle"
                fontSize={9}
                fontWeight="700"
                fill="#ffffff"
              >
                {v.route}
              </SvgText>
            ) : (
              <Circle cx={16} cy={17} r={2.4} fill="#ffffff" />
            )}
          </Svg>
        </View>
      </View>

      <Callout tooltip>
        <View style={styles.callout}>
          <Text style={styles.calloutTitle}>
            {v.type === "bus" ? "Bus" : "Train"} {v.route}
          </Text>
          <Text style={styles.calloutRow}>→ {v.destination}</Text>
          <Text style={styles.calloutRow}>ID: {v.id}</Text>
          <Text style={styles.calloutRow}>{Math.round(v.speed)} mph</Text>
        </View>
      </Callout>
    </Marker>
  );
});

export default VehicleMarker;

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  hitBox: {
    width: HIT_BOX,
    height: HIT_BOX,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  iconWrap: {
    width: ICON_SIZE,
    height: ICON_SIZE,
  },
  callout: {
    minWidth: 160,
    backgroundColor: "rgba(255,255,255,0.97)",
    borderRadius: 8,
    padding: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  calloutTitle: {
    fontWeight: "700",
    fontSize: 13,
    color: "#212121",
    marginBottom: 4,
  },
  calloutRow: {
    fontSize: 12,
    color: "#424242",
    lineHeight: 16,
  },
});
