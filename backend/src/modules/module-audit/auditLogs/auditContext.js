function requestAuditContext(req) {
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const query = req.query && typeof req.query === "object" ? req.query : {};

  return {
    requestId: req.requestId ? String(req.requestId).slice(0, 100) : null,
    method: req.method,
    path: String(req.originalUrl || req.path || "").split("?")[0].slice(0, 500),
    // req.ip only honors forwarded headers when Express has an explicitly trusted proxy.
    ipAddress: req.ip || req.socket?.remoteAddress || null,
    userAgent: (req.get("user-agent") || "").slice(0, 500) || null,
    bodyFields: Object.keys(body).slice(0, 100).map((field) => field.slice(0, 100)),
    queryFields: Object.keys(query).slice(0, 100).map((field) => field.slice(0, 100)),
    batchSize: Array.isArray(body.measurements) ? body.measurements.length : undefined,
  };
}

module.exports = { requestAuditContext };
