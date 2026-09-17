require('dotenv').config({ quiet: true, debug: false });
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const sequelize = require('./src/config/database');

const app = express();

const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.disable('x-powered-by');
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use((req, res, next) => {
  req.requestId = req.get('x-request-id') || crypto.randomUUID();
  res.set('x-request-id', req.requestId);
  next();
});

// Health check
app.get('/api/health', (req, res) => {
  return res.json({ status: 'NovaxIoT API running 🚀' });
});

app.use("/v1/api", require("./src/modules/index.routes"));

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found', code: 'ENDPOINT_NOT_FOUND' });
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  const isCorsError = error?.message === 'Origin not allowed by CORS';
  return res.status(isCorsError ? 403 : 400).json({
    error: isCorsError ? 'Origin not allowed by CORS' : 'Invalid request',
    code: isCorsError ? 'CORS_ORIGIN_DENIED' : 'INVALID_REQUEST',
    request_id: req.requestId,
  });
});

async function start() {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connected");

    app.listen(process.env.PORT, () => {
      console.log(`☁️ NovaxIoT API running on http://localhost:${process.env.PORT}`);
    });

  } catch (error) {
    console.error("❌ Database connection failed:", error);
    process.exit(1);
  }
}

start();
