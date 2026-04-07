#!/usr/bin/env node

/**
 * Reads GTFS shapes.txt + routes.txt + trips.txt and writes an optimized
 * routes.geojson FeatureCollection.
 *
 * Usage:
 *   node backend/scripts/generateGeoJSON.js [--gtfs-dir path] [--out path]
 *
 * Defaults:
 *   --gtfs-dir  backend/data/gtfs
 *   --out       backend/data/routes.geojson
 */

const fs = require("fs");
const path = require("path");
const readline = require("readline");

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

function flag(name, fallback) {
  const idx = args.indexOf(name);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
}

const GTFS_DIR = path.resolve(
  flag("--gtfs-dir", path.join(__dirname, "..", "data", "gtfs"))
);
const OUT_PATH = path.resolve(
  flag("--out", path.join(__dirname, "..", "data", "routes.geojson"))
);

// ---------------------------------------------------------------------------
// Streaming CSV parser (handles quoted fields with commas)
// ---------------------------------------------------------------------------

function parseCsv(filePath) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      return reject(new Error(`File not found: ${filePath}`));
    }

    const rows = [];
    let headers = null;

    const rl = readline.createInterface({
      input: fs.createReadStream(filePath, "utf-8"),
      crlfDelay: Infinity,
    });

    rl.on("line", (raw) => {
      const line = raw.replace(/^\uFEFF/, ""); // strip BOM
      const cols = splitCsvLine(line);
      if (!headers) {
        headers = cols.map((h) => h.trim());
        return;
      }
      const row = {};
      for (let i = 0; i < headers.length; i++) {
        row[headers[i]] = (cols[i] ?? "").trim();
      }
      rows.push(row);
    });

    rl.on("close", () => resolve(rows));
    rl.on("error", reject);
  });
}

// Handles double-quoted fields containing commas
function splitCsvLine(line) {
  const cols = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      cols.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  cols.push(current);
  return cols;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

(async () => {
  console.log(`[generateGeoJSON] GTFS dir : ${GTFS_DIR}`);
  console.log(`[generateGeoJSON] Output   : ${OUT_PATH}`);

  // ---- 1. Parse shapes.txt ------------------------------------------------
  const shapesPath = path.join(GTFS_DIR, "shapes.txt");
  const shapeRows = await parseCsv(shapesPath);
  console.log(`[generateGeoJSON] shapes.txt rows: ${shapeRows.length}`);

  // Group shape points by shape_id, sorted by sequence
  const shapePointMap = new Map(); // shape_id → [{lon, lat, seq}]
  for (const r of shapeRows) {
    const id = r.shape_id;
    if (!shapePointMap.has(id)) shapePointMap.set(id, []);
    shapePointMap.get(id).push({
      lon: parseFloat(r.shape_pt_lon),
      lat: parseFloat(r.shape_pt_lat),
      seq: parseInt(r.shape_pt_sequence, 10),
    });
  }
  for (const pts of shapePointMap.values()) {
    pts.sort((a, b) => a.seq - b.seq);
  }

  // ---- 2. Parse routes.txt → route metadata --------------------------------
  const routesPath = path.join(GTFS_DIR, "routes.txt");
  const routeRows = await parseCsv(routesPath);
  console.log(`[generateGeoJSON] routes.txt rows: ${routeRows.length}`);

  const routeMeta = new Map(); // route_id → { name, color, type }
  for (const r of routeRows) {
    // GTFS route_type: 0=tram, 1=subway, 2=rail, 3=bus
    const typeCode = parseInt(r.route_type, 10);
    routeMeta.set(r.route_id, {
      route_short_name: r.route_short_name || r.route_id,
      route_long_name: r.route_long_name || "",
      route_color: r.route_color ? `#${r.route_color}` : (typeCode === 3 ? "#1b5e20" : "#1565c0"),
      route_type: typeCode === 3 ? "bus" : "rail",
    });
  }

  // ---- 3. Parse trips.txt → shape_id ↔ route_id mapping --------------------
  const tripsPath = path.join(GTFS_DIR, "trips.txt");
  let tripRows = [];
  if (fs.existsSync(tripsPath)) {
    tripRows = await parseCsv(tripsPath);
    console.log(`[generateGeoJSON] trips.txt rows: ${tripRows.length}`);
  } else {
    console.warn(`[generateGeoJSON] trips.txt not found – shapes won't have route metadata`);
  }

  // Map shape_id → route_id (many shapes map to the same route)
  const shapeToRoute = new Map();
  for (const t of tripRows) {
    if (t.shape_id && t.route_id && !shapeToRoute.has(t.shape_id)) {
      shapeToRoute.set(t.shape_id, t.route_id);
    }
  }

  // ---- 4. Deduplicate: keep only the longest shape per route ----------------
  // Multiple shape_ids often describe the same route (inbound vs outbound,
  // short-turns, etc.).  We keep every direction's longest variant.

  // Group shape_ids by route_id
  const routeShapeIds = new Map(); // route_id → [shape_id]
  for (const [shapeId, routeId] of shapeToRoute) {
    if (!routeShapeIds.has(routeId)) routeShapeIds.set(routeId, []);
    routeShapeIds.get(routeId).push(shapeId);
  }

  // For each route, pick the shape with the most points per direction.
  // Simple heuristic: keep the two longest shapes (covers both directions).
  const selectedShapes = new Set();

  for (const [, shapeIds] of routeShapeIds) {
    const sorted = shapeIds
      .filter((id) => shapePointMap.has(id))
      .sort((a, b) => (shapePointMap.get(b)?.length ?? 0) - (shapePointMap.get(a)?.length ?? 0));

    // Keep at most 2 shapes per route (outbound + inbound)
    for (const id of sorted.slice(0, 2)) {
      selectedShapes.add(id);
    }
  }

  // Also include orphan shapes (no trip mapping)
  for (const shapeId of shapePointMap.keys()) {
    if (!shapeToRoute.has(shapeId)) selectedShapes.add(shapeId);
  }

  // ---- 5. Build GeoJSON features -------------------------------------------
  const features = [];

  for (const shapeId of selectedShapes) {
    const pts = shapePointMap.get(shapeId);
    if (!pts || pts.length < 2) continue;

    const routeId = shapeToRoute.get(shapeId) || null;
    const meta = routeId ? routeMeta.get(routeId) : null;

    // Round coordinates to 5 decimal places (~1 m precision) to reduce file size
    const coordinates = pts.map((p) => [
      Math.round(p.lon * 1e5) / 1e5,
      Math.round(p.lat * 1e5) / 1e5,
    ]);

    features.push({
      type: "Feature",
      properties: {
        shape_id: shapeId,
        route_id: routeId,
        route_short_name: meta?.route_short_name ?? null,
        route_long_name: meta?.route_long_name ?? null,
        route_color: meta?.route_color ?? "#888888",
        route_type: meta?.route_type ?? "bus",
      },
      geometry: {
        type: "LineString",
        coordinates,
      },
    });
  }

  const fc = { type: "FeatureCollection", features };

  // ---- 6. Write output -----------------------------------------------------
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(fc));

  const sizeMB = (Buffer.byteLength(JSON.stringify(fc)) / 1e6).toFixed(2);
  console.log(
    `[generateGeoJSON] Wrote ${features.length} features (${sizeMB} MB) to ${OUT_PATH}`
  );
})();
