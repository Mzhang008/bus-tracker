import React, { useMemo } from "react";
import { Geojson } from "react-native-maps";
import { useTransitStore } from "../store/transitStore";
import type { GeoJSONFeatureCollection, GeoJSONFeature } from "../services/api";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RouteLayer() {
  const routeShapes = useTransitStore((s) => s.routeShapes);
  const selectedRoutes = useTransitStore((s) => s.selectedRoutes);

  // Group features by route_id so each route can be rendered with its own color
  const routeCollections = useMemo(() => {
    if (!routeShapes) return [];

    // If selectedRoutes is null → show all; if empty array → show none
    const showAll = selectedRoutes === null;
    const selected = selectedRoutes ? new Set(selectedRoutes) : null;

    const grouped = new Map<string, { color: string; features: GeoJSONFeature[] }>();

    for (const feature of routeShapes.features) {
      const routeId = feature.properties.route_id as string;
      if (!routeId) continue;
      if (!showAll && !(selected?.has(routeId))) continue;

      if (!grouped.has(routeId)) {
        grouped.set(routeId, {
          color: (feature.properties.route_color as string) || "#888",
          features: [],
        });
      }
      grouped.get(routeId)!.features.push(feature);
    }

    return Array.from(grouped.entries()).map(([routeId, { color, features }]) => ({
      routeId,
      color,
      fc: { type: "FeatureCollection", features } as GeoJSONFeatureCollection,
    }));
  }, [routeShapes, selectedRoutes]);

  if (!routeCollections.length) return null;

  return (
    <>
      {routeCollections.map(({ routeId, color, fc }) => (
        <Geojson
          key={routeId}
          geojson={fc as any}
          strokeColor={color}
          strokeWidth={routeId.length <= 3 ? 3 : 2} // thicker for train lines (short IDs)
        />
      ))}
    </>
  );
}
