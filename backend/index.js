require("dotenv").config({ quiet: true, debug: false });
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const sequelize = require("./src/config/database");

const app = express();

const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
if (process.env.WEB_ORIGIN)
  allowedOrigins.push(new URL(process.env.WEB_ORIGIN).origin);
if (process.env.NODE_ENV !== "production")
  allowedOrigins.push("http://localhost:4200", "http://127.0.0.1:4200");

app.disable("x-powered-by");
// Only explicit proxy networks may influence req.secure / client IP.
if (process.env.TRUST_PROXY) app.set("trust proxy", process.env.TRUST_PROXY.split(",").map((value) => value.trim()).filter(Boolean));
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin))
        return callback(null, true);
      return callback(new Error("Origin not allowed by CORS"));
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use((req, res, next) => {
  req.requestId = req.get("x-request-id") || crypto.randomUUID();
  res.set("x-request-id", req.requestId);
  next();
});

// Health check
app.get("/api/health", (req, res) => {
  return res.json({ status: "NovaxIoT API running 🚀" });
});

app.use(
  "/v1/api",
  (req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  },
  require("./src/modules/index.routes"),
);

app.use((req, res) => {
  res
    .status(404)
    .json({ error: "Endpoint not found", code: "ENDPOINT_NOT_FOUND" });
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  const isCorsError = error?.message === "Origin not allowed by CORS";
  return res.status(isCorsError ? 403 : 400).json({
    error: isCorsError ? "Origin not allowed by CORS" : "Invalid request",
    code: isCorsError ? "CORS_ORIGIN_DENIED" : "INVALID_REQUEST",
    request_id: req.requestId,
  });
});

async function start() {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connected");
    const integration = require("./src/modules/module-integration/runtime").startRuntime();
    const server = app.listen(process.env.PORT, () => {
      console.log(
        `☁️ NovaxIoT API running on http://localhost:${process.env.PORT}`,
      );
    });
    let closing = false;
    const shutdown = async () => {
      if (closing) return;
      closing = true;
      const closed = new Promise((resolve) => server.close(resolve));
      await integration.stop();
      await closed;
      await sequelize.close();
    };
    process.once("SIGINT", () => void shutdown());
    process.once("SIGTERM", () => void shutdown());
  } catch (error) {
    console.error("API startup failed", {
      name: error.name,
      code: error.original?.code,
    });
    process.exit(1);
  }
}

if (require.main === module) start();
module.exports = app;
