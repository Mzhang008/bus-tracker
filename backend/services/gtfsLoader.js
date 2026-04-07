const fs = require("fs");
const path = require("path");
const readline = require("readline");

// ---------------------------------------------------------------------------
// In-memory store
// ---------------------------------------------------------------------------

let allShapesFC = null; // full GeoJSON FeatureCollection
const byRoute = new Map(); // routeId → FeatureCollection

const GTFS_DIR = process.env.GTFS_DIR || path.join(__dirname, "..", "data", "gtfs");

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

/**
 * If a pre-built GeoJSON file exists (e.g. exported from GTFS-to-GeoJSON
 * tooling), load it directly.  Otherwise fall back to parsing the raw
 * shapes.txt + trips.txt CSV files that ship inside a GTFS static feed.
 */
async function loadAllShapes() {
  const geojsonPath = path.join(GTFS_DIR, "shapes.geojson");

  if (fs.existsSync(geojsonPath)) {
    const raw = fs.readFileSync(geojsonPath, "utf-8");
    allShapesFC = JSON.parse(raw);
    indexByRoute(allShapesFC);
    return;
  }

  // ---- Build from raw GTFS CSVs ------------------------------------------
  const shapesPath = path.join(GTFS_DIR, "shapes.txt");
  const tripsPath = path.join(GTFS_DIR, "trips.txt");

  if (!fs.existsSync(shapesPath)) {
    throw new Error(`No shapes source found. Place shapes.geojson or GTFS shapes.txt in ${GTFS_DIR}`);
  }

  const shapePoints = await parseCsv(shapesPath);
  const grouped = groupBy(shapePoints, "shape_id");

  // Build a shape_id → route_id lookup from trips.txt (if available)
  let shapeToRoute = new Map();
  if (fs.existsSync(tripsPath)) {
    const trips = await parseCsv(tripsPath);
    for (const t of trips) {
      if (t.shape_id && t.route_id) {
        shapeToRoute.set(t.shape_id, t.route_id);
      }
    }
  }

  const features = [];

  for (const [shapeId, points] of Object.entries(grouped)) {
    // Sort by sequence then build coordinate array [lon, lat]
    points.sort((a, b) => Number(a.shape_pt_sequence) - Number(b.shape_pt_sequence));

    const coordinates = points.map((p) => [
      parseFloat(p.shape_pt_lon),
      parseFloat(p.shape_pt_lat),
    ]);

    features.push({
      type: "Feature",
      properties: {
        shape_id: shapeId,
        route_id: shapeToRoute.get(shapeId) || null,
      },
      geometry: {
        type: "LineString",
        coordinates,
      },
    });
  }

  allShapesFC = { type: "FeatureCollection", features };
  indexByRoute(allShapesFC);
}

// ---------------------------------------------------------------------------
// Indexing
// ---------------------------------------------------------------------------

function indexByRoute(fc) {
  byRoute.clear();
  for (const feature of fc.features) {
    const rid = feature.properties.route_id;
    if (!rid) continue;
    if (!byRoute.has(rid)) {
      byRoute.set(rid, { type: "FeatureCollection", features: [] });
    }
    byRoute.get(rid).features.push(feature);
  }
}

// ---------------------------------------------------------------------------
// CSV streaming parser (no external dependency)
// ---------------------------------------------------------------------------

function parseCsv(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    let headers = null;

    const rl = readline.createInterface({
      input: fs.createReadStream(filePath, "utf-8"),
      crlfDelay: Infinity,
    });

    rl.on("line", (line) => {
      const cols = line.split(",").map((c) => c.trim());
      if (!headers) {
        headers = cols;
        return;
      }
      const row = {};
      for (let i = 0; i < headers.length; i++) {
        row[headers[i]] = cols[i] ?? "";
      }
      rows.push(row);
    });

    rl.on("close", () => resolve(rows));
    rl.on("error", reject);
  });
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function groupBy(arr, key) {
  const map = {};
  for (const item of arr) {
    const k = item[key];
    (map[k] ??= []).push(item);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

function getShapes() {
  return allShapesFC;
}

function getShapeByRoute(routeId) {
  return byRoute.get(routeId) || null;
}

module.exports = { loadAllShapes, getShapes, getShapeByRoute };
