const express = require("express");
const ctaProxy = require("../services/ctaProxy");
const { getShapes, getShapeByRoute } = require("../services/gtfsLoader");

const router = express.Router();

// ---------------------------------------------------------------------------
// CTA real-time proxy routes (buses + trains)
// ---------------------------------------------------------------------------

router.use("/", ctaProxy);

// ---------------------------------------------------------------------------
// Static GTFS route-shape endpoints
// ---------------------------------------------------------------------------

/**
 * GET /api/shapes
 * Returns the full GeoJSON FeatureCollection of every loaded route shape.
 */
router.get("/shapes", (_req, res, next) => {
  try {
    const shapes = getShapes();
    if (!shapes) {
      return res.status(503).json({ error: "Shapes not loaded yet" });
    }
    res.json(shapes);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/shapes/:routeId
 * Returns a GeoJSON FeatureCollection filtered to a single route.
 */
router.get("/shapes/:routeId", (req, res, next) => {
  try {
    const fc = getShapeByRoute(req.params.routeId);
    if (!fc) {
      return res.status(404).json({ error: `No shape for route ${req.params.routeId}` });
    }
    res.json(fc);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
