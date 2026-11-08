const express = require("express");
const { rateLimit } = require("express-rate-limit");
const { ingest } = require("../ingestion/ingestion.service");
const handleError = require("../../../utils/handleError/handleError");
const { requestAuditContext } = require("../../module-audit/auditLogs/auditContext");
const router = express.Router();
router.use(rateLimit({ windowMs: 60000, limit: 1200, standardHeaders: "draft-8", legacyHeaders: false, message: { error: "Demasiados mensajes; reintenta con espera", code: "INGEST_RATE_LIMIT" } }));
router.post("/:external_id", async (req, res) => {
  if (process.env.NODE_ENV === "production" && !req.secure) return res.status(426).json({ error: "La ingesta requiere HTTPS", code: "HTTPS_REQUIRED" });
  try {
    const match = (req.get("authorization") || "").match(/^Bearer\s+(nvx_ingest_[A-Za-z0-9_-]+)$/i);
    const result = await ingest({ sourceExternalId: req.params.external_id, token: match?.[1], envelope: req.body, transport: "HTTPS", request: requestAuditContext(req) });
    return res.status(result.duplicate ? 200 : 201).json({ data: result });
  } catch (error) { return handleError(error, res); }
});
module.exports = router;
