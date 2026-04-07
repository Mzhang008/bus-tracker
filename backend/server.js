require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const { loadAllShapes } = require("./services/gtfsLoader");
const apiRouter = require("./routes/api");
const staticDataRouter = require("./routes/staticData");

const app = express();
const PORT = process.env.PORT || 3001;

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

app.use(
  cors({
    origin: [
      "http://localhost:8081", // Expo dev server (web)
      "http://localhost:19006", // Expo web alt port
      /^http:\/\/192\.168\.\d+\.\d+:\d+$/, // LAN Expo on mobile
    ],
    methods: ["GET"],
  })
);

app.use(express.json());

// ---------------------------------------------------------------------------
// Pre-load GTFS shapes into memory before accepting requests
// ---------------------------------------------------------------------------

(async () => {
  try {
    await loadAllShapes();
    console.log("[gtfs] Route shapes loaded into memory");
  } catch (err) {
    console.error("[gtfs] Failed to load shapes – endpoint will 503:", err.message);
  }

  // ---- Routes -------------------------------------------------------------
  app.use("/api", apiRouter);
  app.use("/api/static", staticDataRouter);

  // ---- Health check -------------------------------------------------------
  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  // ---- Global error handler -----------------------------------------------
  app.use((err, _req, res, _next) => {
    console.error("[error]", err.stack || err.message);
    res.status(500).json({ error: err.message || "Internal server error" });
  });

  // ---- Start --------------------------------------------------------------
  app.listen(PORT, () => {
    console.log(`[server] CTA proxy listening on http://localhost:${PORT}`);
  });
})();
