const express = require("express");
const crypto = require("crypto");
const mongoose = require("mongoose");
const { authenticate, isAdmin } = require("../../../src/middleware/auth");
const {
  mintSocketToken,
  TOKEN_TTL_SECONDS,
} = require("../services/realtimeGateway");
const {
  realtimeMetricsSnapshot,
} = require("../services/realtimeObservability");

const router = express.Router();

router.get("/health", (_req, res) => {
  const databaseReady = mongoose.connection.readyState === 1;
  res.set("Cache-Control", "no-store");
  return res.status(databaseReady ? 200 : 503).json({
    success: databaseReady,
    service: "myzubster-realtime",
    status: databaseReady ? "ready" : "degraded",
    checks: {
      router: "ready",
      mongodb: databaseReady ? "connected" : "disconnected",
    },
    timestamp: new Date().toISOString(),
  });
});

router.post("/token", authenticate, (req, res) => {
  try {
    const correlationId = String(
      req.headers["x-request-id"] || crypto.randomUUID(),
    ).slice(0, 160);
    const token = mintSocketToken({
      userId: req.userId,
      role: req.userRole || "user",
      username: req.username || null,
      correlationId,
    });
    return res.json({
      success: true,
      token,
      expiresInSeconds: TOKEN_TTL_SECONDS,
      socketPath: "/realtime",
      transports: ["websocket", "polling"],
      namespaces: ["user:{id}", "community:{id}", "session:{id}"],
      correlationId,
    });
  } catch (error) {
    console.error("Realtime token error:", error?.name || "Error");
    return res
      .status(503)
      .json({ success: false, error: "Realtime token unavailable" });
  }
});

router.get("/metrics", authenticate, isAdmin, (_req, res) => {
  res.set("Cache-Control", "no-store");
  return res.json({
    success: true,
    privacy: "aggregate-only",
    ...realtimeMetricsSnapshot(),
  });
});

module.exports = router;
