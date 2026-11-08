const { Op } = require("sequelize");
const { AuditLog, Account } = require("../../../config/models");
const AppError = require("../../../utils/handleError/AppError");
const { recordAudit } = require("./auditWriter");

const ALLOWED_ACTIONS = new Set([
  "LIST",
  "READ",
  "CREATE",
  "UPDATE",
  "DELETE",
  "ASSIGN",
  "BULK_CREATE",
  "BOOTSTRAP",
  "LOGIN",
  "LOGOUT",
  "REGISTER",
  "PASSWORD_RECOVERY",
  "PASSWORD_RESET",
  "PASSWORD_CHANGE",
]);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function positiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseDate(value, field) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(
      `${field} debe ser una fecha válida`,
      422,
      "INVALID_DATE",
    );
  }
  return parsed;
}

function serialize(record) {
  const value = record.toJSON();
  delete value.id;
  delete value.tenant_id;
  delete value.actor_account_id;
  delete value.actor_user_id;
  delete value.api_token_id;
  delete value.session_id;
  if (value.actor_account)
    value.actor_account = {
      external_id: value.actor_account.external_id,
      username: value.actor_account.username,
    };
  return value;
}

class AuditLogsService {
  async list(query = {}, context = {}) {
    const page = positiveInt(query.page, 1);
    const pageSize = Math.min(positiveInt(query.page_size, 50), 100);
    const where = { tenant_id: context.auth.tenantId };

    if (query.action) {
      const action = String(query.action).toUpperCase();
      if (!ALLOWED_ACTIONS.has(action)) {
        throw new AppError("action no es válida", 422, "INVALID_AUDIT_ACTION");
      }
      where.action = action;
    }
    if (query.resource) where.resource = String(query.resource).slice(0, 100);
    if (query.resource_external_id) {
      where.resource_external_id = String(query.resource_external_id).slice(
        0,
        160,
      );
    }
    if (query.actor_account_external_id) {
      where.actor_account_external_id = String(query.actor_account_external_id);
    }
    if (query.outcome) where.outcome = String(query.outcome).toUpperCase();
    if (query.status_code) where.status_code = Number(query.status_code);

    const from = parseDate(query.from, "from");
    const to = parseDate(query.to, "to");
    if (from || to) {
      where.created_at = {};
      if (from) where.created_at[Op.gte] = from;
      if (to) where.created_at[Op.lte] = to;
    }

    const result = await AuditLog.findAndCountAll({
      where,
      include: [
        {
          model: Account,
          as: "actor_account",
          attributes: ["external_id", "username"],
          required: false,
          where: { tenant_id: context.auth.tenantId },
        },
      ],
      limit: pageSize,
      offset: (page - 1) * pageSize,
      order: [
        ["created_at", "DESC"],
        ["id", "DESC"],
      ],
      transaction: context.transaction,
    });

    await recordAudit({
      context,
      action: "LIST",
      resource: "audit_logs",
      statusCode: 200,
      details: { result_count: result.rows.length },
      transaction: context.transaction,
    });

    return {
      data: result.rows.map(serialize),
      pagination: {
        page,
        page_size: pageSize,
        total: result.count,
        total_pages: Math.ceil(result.count / pageSize),
      },
    };
  }

  async get(externalId, context = {}) {
    if (!UUID_PATTERN.test(String(externalId || ""))) {
      throw new AppError(
        "external_id no es válido",
        422,
        "INVALID_EXTERNAL_ID",
      );
    }
    const record = await AuditLog.findOne({
      where: { external_id: externalId, tenant_id: context.auth.tenantId },
      include: [
        {
          model: Account,
          as: "actor_account",
          attributes: ["external_id", "username"],
          required: false,
          where: { tenant_id: context.auth.tenantId },
        },
      ],
      transaction: context.transaction,
    });
    if (!record)
      throw new AppError(
        "Evento de auditoría no encontrado",
        404,
        "AUDIT_LOG_NOT_FOUND",
      );

    await recordAudit({
      context,
      action: "READ",
      resource: "audit_logs",
      resourceId: externalId,
      statusCode: 200,
      transaction: context.transaction,
    });
    return serialize(record);
  }
}

module.exports = new AuditLogsService();
