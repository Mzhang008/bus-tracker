import { create } from "zustand";
import {
  fetchBusVehicles,
  fetchTrainPositions,
  fetchAllShapes,
  type GeoJSONFeatureCollection,
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

// ---------------------------------------------------------------------------
// Store shape
// ---------------------------------------------------------------------------

interface TransitState {
  // ---- live vehicle data ---------------------------------------------------
  vehicles: InterpolatedVehicle[];
  rawVehicles: VehiclePosition[];
  lastFetchTs: number | null;

  // ---- watched routes (user-configurable) ----------------------------------
  busRoutes: string;
  trainRoutes: string;

  // ---- static GTFS shapes --------------------------------------------------
  shapes: GeoJSONFeatureCollection | null;
  shapesLoaded: boolean;

  // ---- status --------------------------------------------------------------
  loading: boolean;
  error: string | null;

  // ---- actions -------------------------------------------------------------
  fetchVehicles: () => Promise<void>;
  fetchShapes: () => Promise<void>;
  tick: () => void;
  setRoutes: (bus: string, train: string) => void;
  startPolling: () => () => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useTransitStore = create<TransitState>((set, get) => ({
  vehicles: [],
  rawVehicles: [],
  lastFetchTs: null,

  busRoutes: "22,36,151",
  trainRoutes: "Red,Blue,Brn",

  shapes: null,
  shapesLoaded: false,

  loading: false,
  error: null,

  // ---------- fetch live positions ------------------------------------------

  fetchVehicles: async () => {
    const { busRoutes, trainRoutes } = get();
    set({ loading: true });

    try {
      const [buses, trains] = await Promise.all([
        fetchBusVehicles(busRoutes),
        fetchTrainPositions(trainRoutes),
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

  // ---------- interpolation tick --------------------------------------------

  tick: () => {
    set({ vehicles: getInterpolatedPositions() });
  },

  // ---------- update watched routes -----------------------------------------

  setRoutes: (bus, train) => {
    set({ busRoutes: bus, trainRoutes: train });
    // Immediately re-fetch with the new routes
    get().fetchVehicles();
  },

  // ---------- lifecycle helper ----------------------------------------------

  startPolling: () => {
    const { fetchVehicles, fetchShapes, tick } = get();

    // Initial fetches
    fetchVehicles();
    fetchShapes();

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
