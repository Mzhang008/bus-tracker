const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const router = express.Router();

// ---------------------------------------------------------------------------
// Load routes.geojson once at require-time; compute ETag for caching
// ---------------------------------------------------------------------------

const GEOJSON_PATH =
  process.env.ROUTES_GEOJSON_PATH ||
  path.join(__dirname, "..", "data", "routes.geojson");

let geojsonBuffer = null; // raw Buffer for zero-copy responses
let geojsonETag = null;
let routeIndex = new Map(); // route_id → FeatureCollection
let availableRoutes = []; // [{ route_id, route_short_name, route_color, route_type }]

function loadGeoJSON() {
  if (!fs.existsSync(GEOJSON_PATH)) {
    console.warn(`[staticData] ${GEOJSON_PATH} not found – run generateGeoJSON.js first`);
    return;
  }

  const raw = fs.readFileSync(GEOJSON_PATH);
  geojsonBuffer = raw;
  geojsonETag = `"${crypto.createHash("md5").update(raw).digest("hex")}"`;

  const fc = JSON.parse(raw.toString("utf-8"));

  // Build per-route index and route list
  const seen = new Set();
  routeIndex.clear();
  availableRoutes = [];

  for (const feature of fc.features) {
    const rid = feature.properties.route_id;
    if (!rid) continue;

    if (!routeIndex.has(rid)) {
      routeIndex.set(rid, { type: "FeatureCollection", features: [] });
    }
    routeIndex.get(rid).features.push(feature);

    if (!seen.has(rid)) {
      seen.add(rid);
      availableRoutes.push({
        route_id: rid,
        route_short_name: feature.properties.route_short_name || rid,
        route_long_name: feature.properties.route_long_name || "",
        route_color: feature.properties.route_color || "#888888",
        route_type: feature.properties.route_type || "bus",
      });
    }
  }

  // Sort: rail first, then by route name
  availableRoutes.sort((a, b) => {
    if (a.route_type !== b.route_type) return a.route_type === "rail" ? -1 : 1;
    return a.route_short_name.localeCompare(b.route_short_name, undefined, { numeric: true });
  });

  console.log(
    `[staticData] Loaded ${fc.features.length} shapes, ${availableRoutes.length} routes`
  );
}

loadGeoJSON();

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * GET /api/static/routes.geojson
 * Full FeatureCollection with aggressive caching (immutable until rebuild).
 */
router.get("/routes.geojson", (req, res) => {
  if (!geojsonBuffer) {
    return res.status(503).json({ error: "routes.geojson not loaded – run generateGeoJSON.js" });
  }

  // ETag / conditional request
  if (req.headers["if-none-match"] === geojsonETag) {
    return res.status(304).end();
  }

  res.set({
    "Content-Type": "application/geo+json",
    "Cache-Control": "public, max-age=86400", // 24 h – regenerate after GTFS update
    ETag: geojsonETag,
  });

  res.send(geojsonBuffer);
});

/**
 * GET /api/static/routes
 * Lightweight list of available routes for the toggle UI.
 */
router.get("/routes", (_req, res) => {
  res.json({ routes: availableRoutes });
});

/**
 * GET /api/static/routes/:routeId
 * Filtered FeatureCollection for a single route.
 */
router.get("/routes/:routeId", (req, res) => {
  const fc = routeIndex.get(req.params.routeId);
  if (!fc) {
    return res.status(404).json({ error: `No shapes for route ${req.params.routeId}` });
  }
  res.set("Cache-Control", "public, max-age=86400");
  res.json(fc);
});

module.exports = router;
