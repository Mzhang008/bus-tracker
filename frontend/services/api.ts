import { Platform } from "react-native";
import type { VehiclePosition } from "../utils/interpolateMovement";

// ---------------------------------------------------------------------------
// Base URL – resolves differently on web (same-origin proxy) vs native
// ---------------------------------------------------------------------------

const API_BASE =
  Platform.OS === "web"
    ? "/api"
    : process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001/api";

// ---------------------------------------------------------------------------
// Generic fetch wrapper with timeout + error normalisation
// ---------------------------------------------------------------------------

async function apiFetch<T>(path: string, timeoutMs = 10_000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error ?? `HTTP ${res.status}`);
    }

    return (await res.json()) as T;
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Request timed out");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// API response types
// ---------------------------------------------------------------------------

interface VehiclesResponse {
  vehicles: VehiclePosition[];
  ts: number;
}

interface RoutesResponse {
  routes: Array<{ rt: string; rtnm: string; rtclr: string }>;
}

// GeoJSON types (minimal, avoids an extra dependency)
export interface GeoJSONFeature {
  type: "Feature";
  properties: Record<string, unknown>;
  geometry: {
    type: string;
    coordinates: number[][] | number[][][] ;
  };
}

export interface GeoJSONFeatureCollection {
  type: "FeatureCollection";
  features: GeoJSONFeature[];
}

// ---------------------------------------------------------------------------
// Public API functions
// ---------------------------------------------------------------------------

export async function fetchBusVehicles(routes: string): Promise<VehiclePosition[]> {
  const data = await apiFetch<VehiclesResponse>(
    `/buses/vehicles?routes=${encodeURIComponent(routes)}`
  );
  return data.vehicles;
}

export async function fetchTrainPositions(routes: string): Promise<VehiclePosition[]> {
  const data = await apiFetch<VehiclesResponse>(
    `/trains/positions?routes=${encodeURIComponent(routes)}`
  );
  return data.vehicles;
}

export async function fetchBusRoutes(): Promise<RoutesResponse["routes"]> {
  const data = await apiFetch<RoutesResponse>("/buses/routes");
  return data.routes;
}

export async function fetchAllShapes(): Promise<GeoJSONFeatureCollection> {
  return apiFetch<GeoJSONFeatureCollection>("/shapes");
}

export async function fetchShapeByRoute(routeId: string): Promise<GeoJSONFeatureCollection> {
  return apiFetch<GeoJSONFeatureCollection>(
    `/shapes/${encodeURIComponent(routeId)}`
  );
}
