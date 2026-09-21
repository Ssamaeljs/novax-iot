const bcrypt = require("bcrypt");
const { Op } = require("sequelize");
const {
  sequelize,
  Tenant,
  Account,
  User,
  Role,
  Permission,
  Session,
} = require("../../../config/models");
const DynamicValidator = require("../../../helpers/autoCrud/DynamicValidator");
const AppError = require("../../../utils/handleError/AppError");
const { generateSessionToken } = require("../../../utils/security/apiToken");
const { recordAudit } = require("../../module-audit/auditLogs/auditWriter");

const DUMMY_PASSWORD_HASH =
  "$2b$12$zFp1nQJ6gqwMFHJVp2JEAu1zD/pl240sLKCf3zvpiyKQGBKhhA.mG";

const loginSchema = {
  tenant_slug: {
    required: true,
    type: "string",
    lowercase: true,
    format: "slug",
    maxLength: 80,
  },
  identifier: {
    required: true,
    type: "string",
    lowercase: true,
    minLength: 3,
    maxLength: 160,
  },
  password: {
    required: true,
    type: "string",
    minLength: 1,
    maxLength: 128,
    trim: false,
  },
};

function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed)
    ? Math.min(Math.max(parsed, minimum), maximum)
    : fallback;
}

function accountInclude() {
  return [
    { model: User, as: "user", required: true, where: { is_active: true } },
    {
      model: Role,
      as: "roles",
      required: false,
      where: { is_active: true },
      through: { attributes: [] },
      include: [
        {
          model: Permission,
          as: "permissions",
          required: false,
          where: { is_active: true },
          through: { attributes: [] },
        },
      ],
    },
  ];
}

function identityResponse(tenant, account, session, token) {
  const permissionKeys = [
    ...new Set(
      account.roles.flatMap((role) =>
        role.permissions.map((permission) => permission.key),
      ),
    ),
  ].sort();

  return {
    session: {
      external_id: session.external_id,
      token,
      expires_at: session.expires_at,
    },
    tenant: {
      external_id: tenant.external_id,
      name: tenant.name,
      slug: tenant.slug,
      timezone: tenant.timezone,
    },
    account: {
      external_id: account.external_id,
      username: account.username,
      email: account.email,
    },
    user: {
      external_id: account.user.external_id,
      first_name: account.user.first_name,
      last_name: account.user.last_name,
      id_card: account.user.id_card,
    },
    roles: account.roles.map((role) => ({
      external_id: role.external_id,
      code: role.code,
      name: role.name,
    })),
    permissions: permissionKeys,
  };
}

function profileResponse(tenant, account) {
  const response = identityResponse(
    tenant,
    account,
    { external_id: null, expires_at: null },
    null,
  );
  delete response.session;
  return response;
}

class AuthService {
  constructor() {
    this.validator = new DynamicValidator();
  }

  async login(input, request = {}) {
    const payload = await this.validator.validate(loginSchema, input);
    const tenant = await Tenant.findOne({
      where: { slug: payload.tenant_slug, is_active: true },
    });
    const account = tenant
      ? await Account.findOne({
          where: {
            tenant_id: tenant.id,
            is_active: true,
            [Op.or]: [
              { username: payload.identifier },
              { email: payload.identifier },
            ],
          },
          include: accountInclude(),
        })
      : null;

    const passwordMatches = await bcrypt.compare(
      payload.password,
      account?.password_hash || DUMMY_PASSWORD_HASH,
    );
    const now = new Date();
    const isLocked = account?.locked_until && account.locked_until > now;

    if (!account || !passwordMatches || isLocked) {
      if (account)
        await this.#registerFailedLogin(
          account,
          request,
          isLocked ? "locked" : "invalid_credentials",
        );
      throw new AppError("Credenciales inválidas", 401, "INVALID_CREDENTIALS");
    }

    const ttlMinutes = boundedInteger(
      process.env.SESSION_TTL_MINUTES,
      480,
      15,
      10080,
    );
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
    const generated = generateSessionToken();

    return sequelize.transaction(async (transaction) => {
      // Serialize session issuance with password changes/recovery, then recheck the verified hash.
      const current = await Account.findOne({
        where: { id: account.id, is_active: true },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (
        !current ||
        current.password_hash !== account.password_hash ||
        (current.locked_until && current.locked_until > new Date())
      ) {
        throw new AppError(
          "Credenciales inválidas",
          401,
          "INVALID_CREDENTIALS",
        );
      }
      await current.update(
        { failed_login_attempts: 0, locked_until: null, last_login_at: now },
        { transaction },
      );
      const session = await Session.create(
        {
          tenant_id: tenant.id,
          account_id: account.id,
          token_prefix: generated.tokenPrefix,
          token_hash: generated.tokenHash,
          expires_at: expiresAt,
          ip_address: request.ipAddress,
          user_agent: request.userAgent,
        },
        { transaction },
      );

      await recordAudit({
        context: {
          request,
          auth: {
            type: "session",
            tenantId: tenant.id,
            accountId: account.id,
            accountExternalId: account.external_id,
            userId: account.user.id,
            userExternalId: account.user.external_id,
            sessionId: session.id,
            sessionExternalId: session.external_id,
          },
        },
        action: "LOGIN",
        resource: "sessions",
        resourceId: session.external_id,
        statusCode: 201,
        transaction,
      });

      return identityResponse(tenant, account, session, generated.token);
    });
  }

  async logout(context = {}) {
    if (context.auth?.type !== "session" || !context.auth.sessionId) {
      throw new AppError(
        "El cierre de sesión requiere una sesión de usuario",
        422,
        "SESSION_REQUIRED",
      );
    }

    return sequelize.transaction(async (transaction) => {
      const session = await Session.findOne({
        where: {
          id: context.auth.sessionId,
          tenant_id: context.auth.tenantId,
          revoked_at: null,
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!session)
        throw new AppError(
          "Sesión inválida o expirada",
          401,
          "INVALID_SESSION",
        );

      await session.update({ revoked_at: new Date() }, { transaction });
      await recordAudit({
        context,
        action: "LOGOUT",
        resource: "sessions",
        resourceId: session.external_id,
        statusCode: 204,
        transaction,
      });
    });
  }

  async me(context = {}) {
    const account = await Account.findOne({
      where: {
        id: context.auth.accountId,
        tenant_id: context.auth.tenantId,
        is_active: true,
      },
      include: accountInclude(),
      transaction: context.transaction,
    });
    const tenant = await Tenant.findOne({
      where: { id: context.auth.tenantId, is_active: true },
      transaction: context.transaction,
    });
    if (!account || !tenant)
      throw new AppError("Identidad no disponible", 401, "INVALID_IDENTITY");

    await recordAudit({
      context,
      action: "READ",
      resource: "auth_profile",
      resourceId: account.external_id,
      statusCode: 200,
      transaction: context.transaction,
    });
    return profileResponse(tenant, account);
  }

  async #registerFailedLogin(account, request, reason) {
    const maxAttempts = boundedInteger(
      process.env.LOGIN_MAX_ATTEMPTS,
      5,
      3,
      20,
    );
    const lockMinutes = boundedInteger(
      process.env.LOGIN_LOCK_MINUTES,
      15,
      1,
      1440,
    );

    await sequelize.transaction(async (transaction) => {
      const current = await Account.findByPk(account.id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      const attempts = current.failed_login_attempts + 1;
      const lockedUntil =
        attempts >= maxAttempts
          ? new Date(Date.now() + lockMinutes * 60 * 1000)
          : current.locked_until;
      await current.update(
        { failed_login_attempts: attempts, locked_until: lockedUntil },
        { transaction },
      );
      await recordAudit({
        context: {
          request,
          auth: {
            tenantId: account.tenant_id,
            accountId: account.id,
            accountExternalId: account.external_id,
            userId: account.user.id,
            userExternalId: account.user.external_id,
          },
        },
        action: "LOGIN",
        resource: "sessions",
        outcome: "FAILURE",
        statusCode: 401,
        details: { reason, failed_attempts: attempts },
        transaction,
      });
    });
  }
}

module.exports = new AuthService();
