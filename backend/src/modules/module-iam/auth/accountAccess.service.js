const crypto = require("crypto");
const bcrypt = require("bcrypt");
const { Op } = require("sequelize");
const {
  sequelize,
  Tenant,
  User,
  Account,
  Role,
  Permission,
  Session,
  PasswordReset,
} = require("../../../config/models");
const DynamicValidator = require("../../../helpers/autoCrud/DynamicValidator");
const AppError = require("../../../utils/handleError/AppError");
const { hashToken } = require("../../../utils/security/apiToken");
const { recordAudit } = require("../../module-audit/auditLogs/auditWriter");
const mailer = require("./passwordMailer");

const text = (min, max) => ({
  required: true,
  type: "string",
  minLength: min,
  maxLength: max,
});
const password = { ...text(12, 128), trim: false };
const registrationSchema = {
  tenant_name: text(2, 120),
  tenant_slug: { ...text(2, 80), format: "slug", lowercase: true },
  timezone: text(1, 64),
  first_name: text(2, 120),
  last_name: text(1, 120),
  id_card: { ...text(5, 30), uppercase: true, pattern: /^[A-Z0-9-]+$/ },
  username: { ...text(3, 80), lowercase: true },
  email: { ...text(3, 160), lowercase: true, format: "email" },
  password,
};
async function validate(schema, input) {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    Object.keys(input).some((key) => !Object.hasOwn(schema, key))
  ) {
    throw new AppError("Campos no permitidos", 422, "INVALID_FIELDS");
  }
  const result = await new DynamicValidator().validate(schema, input);
  if (result.password && Buffer.byteLength(result.password, "utf8") > 72)
    throw new AppError(
      "La contraseña admite hasta 72 bytes UTF-8",
      422,
      "INVALID_PASSWORD",
    );
  return result;
}
function accountContext(account, request) {
  return {
    request,
    auth: {
      tenantId: account.tenant_id,
      accountId: account.id,
      accountExternalId: account.external_id,
      userId: account.user_id,
    },
  };
}
function capabilities() {
  return {
    registration_enabled: process.env.PUBLIC_REGISTRATION_ENABLED === "true",
    password_recovery_enabled: mailer.isConfigured(),
  };
}
async function register(input, request) {
  if (!capabilities().registration_enabled)
    throw new AppError(
      "El registro público no está habilitado. Contacta al administrador.",
      403,
      "REGISTRATION_DISABLED",
    );
  const payload = await validate(registrationSchema, input);
  try {
    new Intl.DateTimeFormat("es", { timeZone: payload.timezone });
  } catch {
    throw new AppError("Zona horaria no válida", 422, "INVALID_TIMEZONE");
  }
  const passwordHash = await bcrypt.hash(payload.password, 12);
  return sequelize.transaction(async (transaction) => {
    const tenant = await Tenant.create(
      {
        name: payload.tenant_name,
        slug: payload.tenant_slug,
        timezone: payload.timezone,
      },
      { transaction },
    );
    const user = await User.create(
      {
        tenant_id: tenant.id,
        first_name: payload.first_name,
        last_name: payload.last_name,
        id_card: payload.id_card,
      },
      { transaction },
    );
    const account = await Account.create(
      {
        tenant_id: tenant.id,
        user_id: user.id,
        username: payload.username,
        email: payload.email,
        password_hash: passwordHash,
      },
      { transaction },
    );
    const role = await Role.create(
      {
        tenant_id: tenant.id,
        code: "TENANT_OWNER",
        name: "Propietario",
        is_system: true,
      },
      { transaction },
    );
    const permissions = await Permission.findAll({
      where: { is_active: true },
      transaction,
    });
    await role.setPermissions(permissions, { transaction });
    await account.setRoles([role], { transaction });
    await recordAudit({
      context: accountContext(account, request),
      action: "REGISTER",
      resource: "tenants",
      resourceId: tenant.external_id,
      statusCode: 201,
      transaction,
    });
    return {
      tenant: {
        external_id: tenant.external_id,
        name: tenant.name,
        slug: tenant.slug,
      },
    };
  });
}
async function deliverReset(payload, request) {
  const tenant = await Tenant.findOne({
    where: { slug: payload.tenant_slug, is_active: true },
  });
  if (!tenant) return;
  const token = crypto.randomBytes(32).toString("base64url");
  const recipient = await sequelize.transaction(async (transaction) => {
    const account = await Account.findOne({
      where: { tenant_id: tenant.id, email: payload.email, is_active: true },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (
      !account ||
      !(await User.count({
        where: { id: account.user_id, is_active: true },
        transaction,
      }))
    )
      return null;
    const recent = await PasswordReset.count({
      where: {
        account_id: account.id,
        created_at: { [Op.gt]: new Date(Date.now() - 60000) },
      },
      transaction,
    });
    if (recent) return null;
    await PasswordReset.update(
      { used_at: new Date() },
      { where: { account_id: account.id, used_at: null }, transaction },
    );
    await PasswordReset.create(
      {
        account_id: account.id,
        tenant_id: tenant.id,
        token_hash: hashToken(token),
        expires_at: new Date(Date.now() + 30 * 60000),
      },
      { transaction },
    );
    await recordAudit({
      context: { request, auth: { tenantId: tenant.id } },
      action: "PASSWORD_RECOVERY",
      resource: "accounts",
      resourceId: account.external_id,
      statusCode: 202,
      transaction,
    });
    return account.email;
  });
  if (recipient) await mailer.sendReset(recipient, token);
}
async function forgot(input, request) {
  const payload = await validate(
    {
      tenant_slug: registrationSchema.tenant_slug,
      email: registrationSchema.email,
    },
    input,
  );
  if (!mailer.isConfigured())
    throw new AppError(
      "La recuperación por correo aún no está configurada. Contacta al administrador.",
      503,
      "RECOVERY_NOT_CONFIGURED",
    );
  // Respond before any identity lookup or SMTP work to avoid account enumeration.
  setImmediate(() =>
    deliverReset(payload, request).catch((error) =>
      console.error({ event: "password_recovery_failed", name: error.name }),
    ),
  );
  return {
    message:
      "Si existe una cuenta activa con estos datos, recibirás un enlace para recuperar el acceso.",
  };
}
async function revokeAccess(accountId, transaction) {
  await Session.update(
    { revoked_at: new Date() },
    { where: { account_id: accountId, revoked_at: null }, transaction },
  );
  await PasswordReset.update(
    { used_at: new Date() },
    { where: { account_id: accountId, used_at: null }, transaction },
  );
}
async function reset(input, request) {
  const payload = await validate(
    { token: { ...text(43, 43), pattern: /^[A-Za-z0-9_-]+$/ }, password },
    input,
  );
  const tokenHash = hashToken(payload.token);
  const invalid = () =>
    new AppError(
      "El enlace no es válido o ha expirado. Solicita uno nuevo.",
      422,
      "INVALID_RESET_TOKEN",
    );
  const candidate = await PasswordReset.findOne({
    where: {
      token_hash: tokenHash,
      used_at: null,
      expires_at: { [Op.gt]: new Date() },
    },
  });
  if (!candidate) throw invalid();
  const passwordHash = await bcrypt.hash(payload.password, 12);
  await sequelize.transaction(async (transaction) => {
    // All recovery flows lock the account first to avoid deadlocks and serialize single use.
    const account = await Account.findOne({
      where: {
        id: candidate.account_id,
        tenant_id: candidate.tenant_id,
        is_active: true,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    const tenant = await Tenant.findOne({
      where: { id: candidate.tenant_id, is_active: true },
      transaction,
    });
    const recovery = await PasswordReset.findOne({
      where: {
        id: candidate.id,
        token_hash: tokenHash,
        used_at: null,
        expires_at: { [Op.gt]: new Date() },
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (
      !account ||
      !tenant ||
      !recovery ||
      !(await User.count({
        where: { id: account.user_id, is_active: true },
        transaction,
      }))
    )
      throw invalid();
    await account.update(
      {
        password_hash: passwordHash,
        failed_login_attempts: 0,
        locked_until: null,
      },
      { transaction },
    );
    await revokeAccess(account.id, transaction);
    await recordAudit({
      context: accountContext(account, request),
      action: "PASSWORD_RESET",
      resource: "accounts",
      resourceId: account.external_id,
      transaction,
    });
  });
  return {
    message: "Contraseña actualizada. Inicia sesión con tu nueva contraseña.",
  };
}
async function updateProfile(input, context) {
  const payload = await validate(
    {
      first_name: registrationSchema.first_name,
      last_name: registrationSchema.last_name,
    },
    input,
  );
  await sequelize.transaction(async (transaction) => {
    await User.update(payload, {
      where: { id: context.auth.userId, tenant_id: context.auth.tenantId },
      transaction,
    });
    await recordAudit({
      context,
      action: "UPDATE",
      resource: "auth_profile",
      resourceId: context.auth.userExternalId,
      transaction,
    });
  });
  return require("./auth.service").me(context);
}
async function changePassword(input, context) {
  const payload = await validate(
    { current_password: { ...text(1, 128), trim: false }, password },
    input,
  );
  await sequelize.transaction(async (transaction) => {
    const account = await Account.findOne({
      where: {
        id: context.auth.accountId,
        tenant_id: context.auth.tenantId,
        is_active: true,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (
      !account ||
      !(await bcrypt.compare(payload.current_password, account.password_hash))
    )
      throw new AppError(
        "La contraseña actual no es correcta",
        422,
        "INVALID_CURRENT_PASSWORD",
      );
    await account.update(
      {
        password_hash: await bcrypt.hash(payload.password, 12),
        failed_login_attempts: 0,
        locked_until: null,
      },
      { transaction },
    );
    await revokeAccess(account.id, transaction);
    await recordAudit({
      context,
      action: "PASSWORD_CHANGE",
      resource: "accounts",
      resourceId: account.external_id,
      transaction,
    });
  });
}
module.exports = {
  capabilities,
  register,
  forgot,
  reset,
  updateProfile,
  changePassword,
  validate,
};
