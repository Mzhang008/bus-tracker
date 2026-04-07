import destination from "@turf/destination";
import { point } from "@turf/helpers";

/**
 * Represents a normalized vehicle position returned by the backend proxy.
 */
export interface VehiclePosition {
  id: string;
  type: "bus" | "train";
  lat: number;
  lon: number;
  heading: number; // 0-360, clockwise from north
  speed: number; // miles per hour
  route: string;
  destination: string;
  timestamp: string;
}

/**
 * Snapshot used by the map layer – includes the interpolated coordinates.
 */
export interface InterpolatedVehicle extends VehiclePosition {
  displayLat: number;
  displayLon: number;
}

// ---- internal bookkeeping per vehicle ------------------------------------

interface VehicleState {
  prev: VehiclePosition;
  next: VehiclePosition;
  fetchedAt: number; // ms epoch when the "next" snapshot arrived
}

const POLL_INTERVAL_MS = 15_000;
const vehicleStates = new Map<string, VehicleState>();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Call once per poll cycle with the fresh array from the backend.
 * Shifts current → prev and stores the new positions.
 */
export function updateVehiclePositions(vehicles: VehiclePosition[]): void {
  const now = Date.now();
  for (const v of vehicles) {
    const existing = vehicleStates.get(v.id);
    vehicleStates.set(v.id, {
      prev: existing?.next ?? v,
      next: v,
      fetchedAt: now,
    });
  }

  // Prune vehicles that disappeared from the feed
  const activeIds = new Set(vehicles.map((v) => v.id));
  for (const key of vehicleStates.keys()) {
    if (!activeIds.has(key)) vehicleStates.delete(key);
  }
}

/**
 * Returns the interpolated position for every tracked vehicle at the
 * current instant.  Call this on every animation frame (or a 1-2 s timer)
 * and feed the result straight to the map markers.
 *
 * Interpolation strategy
 * ──────────────────────
 * 1. If we only have one snapshot → return as-is (no prev to interpolate from).
 * 2. Compute `t = elapsed / POLL_INTERVAL` clamped to [0, 1].
 * 3. For buses (speed > 0) → project from `prev` along heading by
 *    `speed × elapsed`, using Turf `destination`.  This gives a smooth
 *    straight-line advance that matches the real-world motion between polls.
 * 4. For trains or vehicles with speed === 0 → linear lat/lon lerp between
 *    prev and next (adequate because rail movement is constrained to tracks
 *    and the 15 s delta is small).
 * 5. Once `t >= 1` we clamp to the `next` position so we never overshoot.
 */
export function getInterpolatedPositions(): InterpolatedVehicle[] {
  const now = Date.now();
  const results: InterpolatedVehicle[] = [];

  for (const state of vehicleStates.values()) {
    const { prev, next, fetchedAt } = state;
    const elapsed = now - fetchedAt;
    const t = Math.min(elapsed / POLL_INTERVAL_MS, 1);

    let displayLat: number;
    let displayLon: number;

    if (t >= 1 || (prev.lat === next.lat && prev.lon === next.lon)) {
      // Clamp to latest known position
      displayLat = next.lat;
      displayLon = next.lon;
    } else if (next.speed > 0) {
      // Dead-reckoning projection along heading
      const elapsedHours = (elapsed / 1000) / 3600;
      const distanceMiles = next.speed * elapsedHours;

      const origin = point([prev.lon, prev.lat]);
      const projected = destination(origin, distanceMiles, next.heading, {
        units: "miles",
      });

      const [projLon, projLat] = projected.geometry.coordinates;

      // Blend projection with the known next position so we converge
      displayLat = projLat + (next.lat - projLat) * t;
      displayLon = projLon + (next.lon - projLon) * t;
    } else {
      // Simple linear interpolation
      displayLat = prev.lat + (next.lat - prev.lat) * t;
      displayLon = prev.lon + (next.lon - prev.lon) * t;
    }

    results.push({ ...next, displayLat, displayLon });
  }

  return results;
}
