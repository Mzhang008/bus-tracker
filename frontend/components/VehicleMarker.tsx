import React from "react";
import { StyleSheet, View, Text } from "react-native";
import { Marker, Callout } from "react-native-maps";
import Svg, { Path, Circle, Text as SvgText } from "react-native-svg";
import type { InterpolatedVehicle } from "../utils/interpolateMovement";

// ---------------------------------------------------------------------------
// Train line registry — single source of truth for color + display name.
// Mirrors TransitMap.web.tsx.
// ---------------------------------------------------------------------------

interface LineDef {
  canonical: string;
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
  name: string;
}

function resolveLine(route: string | undefined | null): ResolvedLine | null {
  const key = normaliseKey(route);
  if (!key) return null;

  const exact = LINE_BY_ALIAS[key];
  if (exact) return { color: exact.color, name: `${exact.canonical} Line` };

  for (const def of LINES) {
    if (
      key.startsWith(def.canonical.toLowerCase()) ||
      def.aliases.some((a) => a.length > 1 && key.startsWith(a))
    ) {
      return { color: def.color, name: `${def.canonical} Line` };
    }
  }
  return null;
}

function vehicleColor(v: InterpolatedVehicle): string {
  if (v.type === "train") {
    return resolveLine(v.route)?.color ?? "#555";
  }
  return "#1b5e20";
}

function vehicleLabel(v: InterpolatedVehicle): string {
  if (v.type === "train") {
    const line = resolveLine(v.route);
    const name = line ? line.name : `${v.route ?? "?"} Line`;
    return `Train · ${name} · ${v.destination}`;
  }
  return `Bus · ${v.route} · ${v.destination}`;
}

// TODO: zoom-responsive marker scaling on native — react-native-maps
// doesn't expose zoom as cleanly as react-map-gl. Deployed target is web.

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
          <Text style={styles.calloutTitle}>{vehicleLabel(v)}</Text>
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
