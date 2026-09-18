function compactDetails(request = {}, extra = {}) {
  const details = {
    body_fields: request.bodyFields || [],
    query_fields: request.queryFields || [],
    ...extra,
  };
  if (request.batchSize !== undefined) details.batch_size = request.batchSize;
  return details;
}

async function recordAudit({
  context = {},
  action,
  resource,
  resourceId = null,
  statusCode = 200,
  outcome = "SUCCESS",
  details = {},
  transaction,
}) {
  if (context.suppressAudit) return null;
  const auth = context.auth;
  if (!auth?.tenantId) return null;

  // Lazy import avoids a circular dependency while Sequelize initializes models.
  const { AuditLog } = require("../../../config/models");
  return AuditLog.create(
    {
      tenant_id: auth.tenantId,
      actor_account_id: auth.accountId || null,
      actor_user_id: auth.userId || null,
      api_token_id: auth.tokenId || null,
      session_id: auth.sessionId || null,
      actor_account_external_id: auth.accountExternalId || null,
      actor_user_external_id: auth.userExternalId || null,
      api_token_external_id: auth.tokenExternalId || null,
      session_external_id: auth.sessionExternalId || null,
      action,
      resource,
      resource_external_id:
        resourceId === undefined || resourceId === null ? null : String(resourceId).slice(0, 160),
      outcome,
      status_code: statusCode,
      request_id: context.request?.requestId || null,
      http_method: context.request?.method || null,
      path: context.request?.path || null,
      ip_address: context.request?.ipAddress || null,
      user_agent: context.request?.userAgent || null,
      details: compactDetails(context.request, details),
    },
    { transaction },
  );
}

module.exports = { recordAudit };
