const { Op } = require("sequelize");
const {
  ApiToken,
  Session,
  Account,
  User,
  Role,
  Permission,
  Tenant,
} = require("../config/models");
const { hashToken } = require("../utils/security/apiToken");
const AppError = require("../utils/handleError/AppError");
const handleError = require("../utils/handleError/handleError");

function credentialIncludes() {
  return [
    { model: Tenant, as: "tenant", required: true, where: { is_active: true } },
    {
    model: Account,
    as: "account",
    required: true,
    where: { is_active: true },
    include: [
      {
        model: User,
        as: "user",
        required: true,
        where: { is_active: true },
      },
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
    ],
    },
  ];
}

function rolePermissions(account) {
  return new Set(
    account.roles.flatMap((role) => role.permissions.map((permission) => permission.key)),
  );
}

function baseIdentity(credential, type) {
  return {
    type,
    accountId: credential.account_id,
    accountExternalId: credential.account.external_id,
    userId: credential.account.user_id,
    userExternalId: credential.account.user.external_id,
    tenantId: credential.tenant_id,
  };
}

async function authenticateBearer(req, res, next) {
  try {
    const authorization = req.get("authorization") || "";
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      throw new AppError("Token requerido", 401, "AUTHENTICATION_REQUIRED");
    }

    const rawToken = match[1];
    const tokenHash = hashToken(rawToken);

    if (rawToken.startsWith("nvx_session_")) {
      const session = await Session.findOne({
        where: {
          token_hash: tokenHash,
          revoked_at: null,
          expires_at: { [Op.gt]: new Date() },
        },
        include: credentialIncludes(),
      });
      if (!session || session.account.tenant_id !== session.tenant_id) {
        throw new AppError("Sesión inválida o expirada", 401, "INVALID_SESSION");
      }

      req.auth = {
        ...baseIdentity(session, "session"),
        sessionId: session.id,
        sessionExternalId: session.external_id,
        permissions: rolePermissions(session.account),
      };

      const lastUsed = session.last_used_at?.getTime?.() || 0;
      if (Date.now() - lastUsed > 5 * 60 * 1000) {
        await session.update({ last_used_at: new Date() }, { hooks: false });
      }
      return next();
    }

    const apiToken = await ApiToken.findOne({
      where: {
        token_hash: tokenHash,
        is_active: true,
        revoked_at: null,
        [Op.or]: [{ expires_at: null }, { expires_at: { [Op.gt]: new Date() } }],
      },
      include: credentialIncludes(),
    });
    if (!apiToken || apiToken.account.tenant_id !== apiToken.tenant_id) {
      throw new AppError("Token inválido o expirado", 401, "INVALID_API_TOKEN");
    }

    const permissions = rolePermissions(apiToken.account);
    const tokenScopes = Array.isArray(apiToken.scopes) ? apiToken.scopes : [];
    const effectivePermissions = tokenScopes.length
      ? new Set([...permissions].filter((permission) => tokenScopes.includes(permission)))
      : permissions;

    req.auth = {
      ...baseIdentity(apiToken, "api_token"),
      tokenId: apiToken.id,
      tokenExternalId: apiToken.external_id,
      permissions: effectivePermissions,
    };

    const lastUsed = apiToken.last_used_at?.getTime?.() || 0;
    if (Date.now() - lastUsed > 5 * 60 * 1000) {
      await apiToken.update({ last_used_at: new Date() }, { hooks: false });
    }

    return next();
  } catch (error) {
    return handleError(error, res);
  }
}

module.exports = {
  authenticateBearer,
  authenticateApiToken: authenticateBearer,
};
