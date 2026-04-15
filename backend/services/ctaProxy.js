const express = require("express");
const NodeCache = require("node-cache");
const axios = require("axios");

const router = express.Router();
const cache = new NodeCache({ stdTTL: 15, checkperiod: 5 });

const CTA_BUS_BASE = "http://www.ctabustracker.com/bustime/api/v2";
const CTA_TRAIN_BASE = "http://lapi.transitchicago.com/api/1.0";

const BUS_API_KEY = process.env.CTA_BUS_API_KEY;
const TRAIN_API_KEY = process.env.CTA_TRAIN_API_KEY;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchWithCache(cacheKey, fetchFn) {
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const data = await fetchFn();
  cache.set(cacheKey, data);
  return data;
}

function normalizeBusVehicle(v) {
  return {
    id: v.vid,
    type: "bus",
    lat: parseFloat(v.lat),
    lon: parseFloat(v.lon),
    heading: parseInt(v.hdg, 10),
    speed: parseFloat(v.spd) || 0, // mph from API
    route: v.rt,
    destination: v.des,
    timestamp: v.tmstmp,
  };
}

function normalizeTrainRun(run) {
  return {
    id: run.rn,
    type: "train",
    lat: parseFloat(run.lat),
    lon: parseFloat(run.lon),
    heading: parseInt(run.heading, 10),
    speed: 0, // Train API does not provide speed; frontend will derive it
    route: canonicalTrainRoute(run.rt),
    destination: run.destNm,
    timestamp: run.prdt,
  };
}

// CTA Train Tracker accepts/returns route codes in mixed case (e.g. "red",
// "Brn"). Normalise to the GTFS route_id form so the frontend's TRAIN_COLORS
// lookup and FilterMenu selection (both sourced from GTFS) line up.
const TRAIN_ROUTE_CANONICAL = {
  red: "Red",
  blue: "Blue",
  brn: "Brn",
  g: "G",
  org: "Org",
  p: "P",
  pink: "Pink",
  y: "Y",
};
function canonicalTrainRoute(rt) {
  if (!rt) return rt;
  return TRAIN_ROUTE_CANONICAL[String(rt).toLowerCase()] ?? rt;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * GET /api/buses/vehicles?routes=22,36,...
 * Returns normalized vehicle positions for the requested bus routes.
 */
router.get("/buses/vehicles", async (req, res, next) => {
  try {
    const routes = req.query.routes; // comma-separated
    if (!routes) return res.status(400).json({ error: "routes param required" });

    const cacheKey = `bus_vehicles_${routes}`;
    const data = await fetchWithCache(cacheKey, async () => {
      const { data: resp } = await axios.get(`${CTA_BUS_BASE}/getvehicles`, {
        params: { key: BUS_API_KEY, rt: routes, format: "json" },
      });

      const body = resp["bustime-response"];
      if (body.error) throw new Error(body.error[0].msg);
      return (body.vehicle || []).map(normalizeBusVehicle);
    });

    return res.json({ vehicles: data, ts: Date.now() });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/trains/positions?routes=Red,Blue,...
 * Returns normalized train positions for the requested lines.
 */
router.get("/trains/positions", async (req, res, next) => {
  try {
    const routes = req.query.routes;
    if (!routes) return res.status(400).json({ error: "routes param required" });

    const cacheKey = `train_positions_${routes}`;
    const data = await fetchWithCache(cacheKey, async () => {
      const routeList = routes.split(",");
      const allRuns = [];

      // Train API requires one route per call
      await Promise.all(
        routeList.map(async (rt) => {
          const { data: resp } = await axios.get(
            `${CTA_TRAIN_BASE}/ttpositions.aspx`,
            { params: { key: TRAIN_API_KEY, rt, outputType: "JSON" } }
          );

          const body = resp.ctatt;
          if (body.errNm) throw new Error(body.errNm);
          const routeObj = body.route;
          if (!routeObj) return;

          const trains = Array.isArray(routeObj) ? routeObj : [routeObj];
          for (const r of trains) {
            const runs = r.train ? (Array.isArray(r.train) ? r.train : [r.train]) : [];
            allRuns.push(...runs.map(normalizeTrainRun));
          }
        })
      );

      return allRuns;
    });

    return res.json({ vehicles: data, ts: Date.now() });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/buses/routes
 * Returns available bus routes (cached longer – 5 min).
 */
router.get("/buses/routes", async (req, res, next) => {
  try {
    const cacheKey = "bus_routes";
    let data = cache.get(cacheKey);
    if (!data) {
      const { data: resp } = await axios.get(`${CTA_BUS_BASE}/getroutes`, {
        params: { key: BUS_API_KEY, format: "json" },
      });
      const body = resp["bustime-response"];
      if (body.error) throw new Error(body.error[0].msg);
      data = body.routes || [];
      cache.set(cacheKey, data, 300);
    }
    return res.json({ routes: data });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
