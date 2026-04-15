import { Platform } from "react-native";
import { create } from "zustand";
import {
  fetchBusVehicles,
  fetchTrainPositions,
  fetchAllShapes,
  fetchRouteShapes,
  fetchAvailableRoutes,
  type GeoJSONFeatureCollection,
  type RouteInfo,
} from "../services/api";
import {
  type VehiclePosition,
  type InterpolatedVehicle,
  updateVehiclePositions,
  getInterpolatedPositions,
} from "../utils/interpolateMovement";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const POLL_MS = 15_000;
const INTERPOLATION_MS = 1_000;
const STORAGE_KEY = "cta-tracker.selectedRoutes";

// ---------------------------------------------------------------------------
// Persistence (web only — native skipped to avoid AsyncStorage dep)
// ---------------------------------------------------------------------------

function loadPersistedSelection(): string[] {
  if (Platform.OS !== "web" || typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function persistSelection(ids: string[]): void {
  if (Platform.OS !== "web" || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* quota / disabled — non-fatal */
  }
}

// ---------------------------------------------------------------------------
// Store shape
// ---------------------------------------------------------------------------

interface TransitState {
  // ---- live vehicle data ---------------------------------------------------
  vehicles: InterpolatedVehicle[];
  rawVehicles: VehiclePosition[];
  lastFetchTs: number | null;

  // ---- static GTFS shapes (legacy loader) ----------------------------------
  shapes: GeoJSONFeatureCollection | null;
  shapesLoaded: boolean;

  // ---- generated route shapes (generateGeoJSON.js) -------------------------
  routeShapes: GeoJSONFeatureCollection | null;
  availableRoutes: RouteInfo[];
  selectedRoutes: string[]; // empty = nothing selected

  // ---- visibility toggles --------------------------------------------------
  showBusRoutes: boolean;
  showTrainRoutes: boolean;
  showBusVehicles: boolean;
  showTrainVehicles: boolean;

  // ---- status --------------------------------------------------------------
  loading: boolean;
  error: string | null;

  // ---- actions -------------------------------------------------------------
  fetchVehicles: () => Promise<void>;
  fetchShapes: () => Promise<void>;
  fetchRouteShapes: () => Promise<void>;
  tick: () => void;
  toggleLayer: (layer: "showBusRoutes" | "showTrainRoutes" | "showBusVehicles" | "showTrainVehicles") => void;
  toggleRoute: (routeId: string) => void;
  selectAllOfType: (type: "bus" | "rail") => void;
  clearAllOfType: (type: "bus" | "rail") => void;
  startPolling: () => () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function partitionByType(
  selectedRoutes: string[],
  availableRoutes: RouteInfo[]
): { bus: string[]; rail: string[] } {
  const typeById = new Map(availableRoutes.map((r) => [r.route_id, r.route_type]));
  const bus: string[] = [];
  const rail: string[] = [];
  for (const id of selectedRoutes) {
    const t = typeById.get(id);
    if (t === "rail") rail.push(id);
    else if (t === "bus") bus.push(id);
  }
  return { bus, rail };
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useTransitStore = create<TransitState>((set, get) => ({
  vehicles: [],
  rawVehicles: [],
  lastFetchTs: null,

  shapes: null,
  shapesLoaded: false,

  routeShapes: null,
  availableRoutes: [],
  selectedRoutes: loadPersistedSelection(),

  // Default OFF — user opts in via filter menu
  showBusRoutes: false,
  showTrainRoutes: false,
  showBusVehicles: false,
  showTrainVehicles: false,

  loading: false,
  error: null,

  // ---------- fetch live positions ------------------------------------------

  fetchVehicles: async () => {
    const { selectedRoutes, availableRoutes } = get();

    // Nothing selected → clear vehicles, skip network
    if (selectedRoutes.length === 0 || availableRoutes.length === 0) {
      updateVehiclePositions([]);
      set({ rawVehicles: [], vehicles: [], lastFetchTs: Date.now(), error: null });
      return;
    }

    const { bus, rail } = partitionByType(selectedRoutes, availableRoutes);

    set({ loading: true });
    try {
      const [buses, trains] = await Promise.all([
        bus.length ? fetchBusVehicles(bus.join(",")) : Promise.resolve([]),
        rail.length ? fetchTrainPositions(rail.join(",")) : Promise.resolve([]),
      ]);

      const all = [...buses, ...trains];
      updateVehiclePositions(all);

      set({
        rawVehicles: all,
        vehicles: getInterpolatedPositions(),
        lastFetchTs: Date.now(),
        loading: false,
        error: null,
      });
    } catch (err: unknown) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : "Vehicle fetch failed",
      });
    }
  },

  // ---------- fetch static shapes (once) ------------------------------------

  fetchShapes: async () => {
    if (get().shapesLoaded) return;

    try {
      const shapes = await fetchAllShapes();
      set({ shapes, shapesLoaded: true });
    } catch (err: unknown) {
      console.warn(
        "[transitStore] shapes load failed:",
        err instanceof Error ? err.message : err
      );
      // Non-fatal – the map still works without shape overlays
    }
  },

  // ---------- fetch generated route shapes (once) ---------------------------

  fetchRouteShapes: async () => {
    try {
      const [routeShapes, availableRoutes] = await Promise.all([
        fetchRouteShapes(),
        fetchAvailableRoutes(),
      ]);
      set({ routeShapes, availableRoutes });

      // If we restored a persisted selection, kick off a vehicle fetch now
      // that we know which routes are bus vs rail.
      if (get().selectedRoutes.length > 0) {
        get().fetchVehicles();
      }
    } catch (err: unknown) {
      console.warn(
        "[transitStore] route shapes load failed:",
        err instanceof Error ? err.message : err
      );
    }
  },

  // ---------- interpolation tick --------------------------------------------

  tick: () => {
    set({ vehicles: getInterpolatedPositions() });
  },

  // ---------- visibility toggles ---------------------------------------------

  toggleLayer: (layer) => {
    set((s) => ({ [layer]: !s[layer] }));
  },

  // ---------- per-route selection -------------------------------------------

  toggleRoute: (routeId) => {
    const { selectedRoutes, availableRoutes } = get();
    const isSelected = selectedRoutes.includes(routeId);
    const next = isSelected
      ? selectedRoutes.filter((id) => id !== routeId)
      : [...selectedRoutes, routeId];

    // First selection of a type → auto-enable that type's layers so
    // the user actually sees something on the map.
    const patch: Partial<TransitState> = { selectedRoutes: next };
    if (!isSelected) {
      const meta = availableRoutes.find((r) => r.route_id === routeId);
      if (meta?.route_type === "bus") {
        patch.showBusVehicles = true;
        patch.showBusRoutes = true;
      } else if (meta?.route_type === "rail") {
        patch.showTrainVehicles = true;
        patch.showTrainRoutes = true;
      }
    }

    set(patch);
    persistSelection(next);
    get().fetchVehicles();
  },

  selectAllOfType: (type) => {
    const { selectedRoutes, availableRoutes } = get();
    const idsOfType = availableRoutes
      .filter((r) => r.route_type === type)
      .map((r) => r.route_id);
    const merged = Array.from(new Set([...selectedRoutes, ...idsOfType]));

    set({
      selectedRoutes: merged,
      ...(type === "bus"
        ? { showBusVehicles: true, showBusRoutes: true }
        : { showTrainVehicles: true, showTrainRoutes: true }),
    });
    persistSelection(merged);
    get().fetchVehicles();
  },

  clearAllOfType: (type) => {
    const { selectedRoutes, availableRoutes } = get();
    const dropIds = new Set(
      availableRoutes.filter((r) => r.route_type === type).map((r) => r.route_id)
    );
    const next = selectedRoutes.filter((id) => !dropIds.has(id));
    set({ selectedRoutes: next });
    persistSelection(next);
    get().fetchVehicles();
  },

  // ---------- lifecycle helper ----------------------------------------------

  startPolling: () => {
    const { fetchVehicles, fetchShapes, tick } = get();

    // Initial fetches
    fetchShapes();
    get().fetchRouteShapes();
    fetchVehicles();

    // 15 s vehicle poll
    const pollId = setInterval(fetchVehicles, POLL_MS);

    // 1 s interpolation tick
    const tickId = setInterval(tick, INTERPOLATION_MS);

    // Return cleanup function for useEffect
    return () => {
      clearInterval(pollId);
      clearInterval(tickId);
    };
  },
}));
