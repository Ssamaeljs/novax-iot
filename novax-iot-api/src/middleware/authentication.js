const { Op } = require("sequelize");
const { ApiToken, Account, User, Role, Permission } = require("../config/models");
const { hashToken } = require("../utils/security/apiToken");
const AppError = require("../utils/handleError/AppError");
const handleError = require("../utils/handleError/handleError");

async function authenticateApiToken(req, res, next) {
  try {
    const authorization = req.get("authorization") || "";
    const match = authorization.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      throw new AppError("Token de API requerido", 401, "AUTHENTICATION_REQUIRED");
    }

    const apiToken = await ApiToken.findOne({
      where: {
        token_hash: hashToken(match[1]),
        is_active: true,
        revoked_at: null,
        [Op.or]: [{ expires_at: null }, { expires_at: { [Op.gt]: new Date() } }],
      },
      include: [
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
      ],
    });

    if (!apiToken || apiToken.account.tenant_id !== apiToken.tenant_id) {
      throw new AppError("Token inválido o expirado", 401, "INVALID_API_TOKEN");
    }

    const rolePermissions = new Set(
      apiToken.account.roles.flatMap((role) => role.permissions.map((permission) => permission.key)),
    );
    const tokenScopes = Array.isArray(apiToken.scopes) ? apiToken.scopes : [];
    const effectivePermissions = tokenScopes.length
      ? new Set([...rolePermissions].filter((permission) => tokenScopes.includes(permission)))
      : rolePermissions;

    req.auth = {
      type: "api_token",
      tokenId: apiToken.id,
      tokenExternalId: apiToken.external_id,
      accountId: apiToken.account_id,
      accountExternalId: apiToken.account.external_id,
      userId: apiToken.account.user_id,
      userExternalId: apiToken.account.user.external_id,
      tenantId: apiToken.tenant_id,
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

module.exports = { authenticateApiToken };

