const { Op } = require("sequelize");
const AppError = require("../../utils/handleError/AppError");
const { recordAudit } = require("../../modules/module-audit/auditLogs/auditWriter");
const DynamicValidator = require("./DynamicValidator");
const automaticCode = require("../../utils/automaticCode");

const RESERVED_QUERY_FIELDS = new Set([
  "page",
  "page_size",
  "search",
  "sort_by",
  "sort_dir",
]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

class AutoCrudService {
  constructor(options) {
    if (!options?.model) throw new Error("AutoCrudService requires a Sequelize model");

    this.model = options.model;
    this.automaticCodePrefix = options.automaticCodePrefix;
    this.publicId = options.publicId || "external_id";
    this.writableFields = options.writableFields || this.#inferWritableFields();
    this.virtualFields = options.virtualFields || [];
    this.filterableFields = options.filterableFields || [];
    this.searchableFields = options.searchableFields || [];
    this.sortableFields = options.sortableFields || ["created_at"];
    this.defaultSort = options.defaultSort || ["created_at", "DESC"];
    this.maxPageSize = options.maxPageSize || 100;
    this.softDeleteField = options.softDeleteField === undefined ? "is_active" : options.softDeleteField;
    this.hiddenFields = new Set(["id", "tenant_id", ...(options.hiddenFields || [])]);
    this.schemas = options.schemas || {};
    this.validators = options.validators || {};
    this.hooks = options.hooks || {};
    this.include = options.include || [];
    this.scope = options.scope;
    this.auditResource = options.auditResource || this.#modelResource();
    this.validator = options.validator || new DynamicValidator();
  }

  async list(query = {}, context = {}) {
    const page = this.#positiveInt(query.page, 1);
    const pageSize = Math.min(this.#positiveInt(query.page_size, 25), this.maxPageSize);
    const where = await this.#buildWhere(query, context);
    const order = this.#buildOrder(query);

    const result = await this.model.findAndCountAll({
      where,
      include: this.include,
      distinct: this.include.length > 0,
      limit: pageSize,
      offset: (page - 1) * pageSize,
      order,
      transaction: context.transaction,
    });

    await recordAudit({
      context,
      action: "LIST",
      resource: this.auditResource,
      statusCode: 200,
      details: { result_count: result.rows.length },
      transaction: context.transaction,
    });

    return {
      data: result.rows.map((row) => this.serialize(row)),
      pagination: {
        page,
        page_size: pageSize,
        total: result.count,
        total_pages: Math.ceil(result.count / pageSize),
      },
    };
  }

  async get(identifier, context = {}, options = {}) {
    const record = await this.findRecord(identifier, context, options);
    await recordAudit({
      context,
      action: "READ",
      resource: this.auditResource,
      resourceId: identifier,
      statusCode: 200,
      transaction: options.transaction || context.transaction,
    });
    return this.serialize(record);
  }

  async findRecord(identifier, context = {}, options = {}) {
    if (this.publicId === "external_id" && !UUID_PATTERN.test(String(identifier || ""))) {
      throw new AppError("external_id no es válido", 422, "INVALID_EXTERNAL_ID");
    }
    const scopeWhere = await this.#scopeWhere(context);
    const where = { ...scopeWhere, [this.publicId]: identifier };
    const record = await this.model.findOne({
      where,
      include: options.include || this.include,
      transaction: options.transaction || context.transaction,
    });

    if (!record) {
      throw new AppError("Recurso no encontrado", 404, "RESOURCE_NOT_FOUND");
    }
    return record;
  }

  async create(input, context = {}) {
    return this.#withTransaction(context, async (transaction) => {
      const rawPayload = await this.#validateInput("create", input, context);
      const transformed = this.hooks.transformInput
        ? await this.hooks.transformInput("create", rawPayload, context, transaction)
        : rawPayload;
      const payload = this.#sanitizePayload(transformed);
      if (this.automaticCodePrefix) payload.code = automaticCode(this.automaticCodePrefix);
      this.#applyTenant(payload, context);

      if (this.hooks.beforeCreate) {
        await this.hooks.beforeCreate(payload, context, transaction);
      }

      const instance = this.model.build(payload);
      await instance.validate({ transaction });
      await instance.save({ transaction });

      if (this.hooks.afterCreate) {
        await this.hooks.afterCreate(instance, context, transaction);
      }

      await recordAudit({
        context,
        action: "CREATE",
        resource: this.auditResource,
        resourceId: instance.get(this.publicId),
        statusCode: 201,
        transaction,
      });

      return this.serialize(instance);
    });
  }

  async update(identifier, input, context = {}) {
    return this.#withTransaction(context, async (transaction) => {
      const record = await this.findRecord(identifier, context, { transaction, include: [] });
      const rawPayload = await this.#validateInput("update", input, context);
      const transformed = this.hooks.transformInput
        ? await this.hooks.transformInput("update", rawPayload, context, transaction, record)
        : rawPayload;
      const payload = this.#sanitizePayload(transformed);
      delete payload.tenant_id;

      if (Object.keys(payload).length === 0) {
        throw new AppError("No hay campos válidos para actualizar", 422, "EMPTY_UPDATE");
      }

      if (this.hooks.beforeUpdate) {
        await this.hooks.beforeUpdate(record, payload, context, transaction);
      }

      record.set(payload);
      await record.validate({ transaction });
      await record.save({ transaction });

      if (this.hooks.afterUpdate) {
        await this.hooks.afterUpdate(record, context, transaction, payload);
      }

      await recordAudit({
        context,
        action: "UPDATE",
        resource: this.auditResource,
        resourceId: record.get(this.publicId),
        statusCode: 200,
        transaction,
      });

      return this.serialize(record);
    });
  }

  async delete(identifier, context = {}) {
    return this.#withTransaction(context, async (transaction) => {
      const record = await this.findRecord(identifier, context, { transaction, include: [] });

      if (this.hooks.beforeDelete) {
        await this.hooks.beforeDelete(record, context, transaction);
      }

      if (this.softDeleteField && this.model.rawAttributes[this.softDeleteField]) {
        record.set(this.softDeleteField, false);
        await record.save({ transaction });
      } else {
        await record.destroy({ transaction });
      }

      if (this.hooks.afterDelete) {
        await this.hooks.afterDelete(record, context, transaction);
      }

      await recordAudit({
        context,
        action: "DELETE",
        resource: this.auditResource,
        resourceId: record.get(this.publicId),
        statusCode: 204,
        transaction,
      });
    });
  }

  serialize(record) {
    const value = typeof record?.toJSON === "function" ? record.toJSON() : { ...record };
    return this.#sanitizeOutput(value);
  }

  async #validateInput(operation, input, context) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw new AppError("El cuerpo debe ser un objeto JSON", 400, "INVALID_BODY");
    }

    const schemaFields = Object.keys(this.schemas[operation] || {});
    const allowedInput = new Set(
      schemaFields.length ? schemaFields : [...this.writableFields, ...this.virtualFields],
    );
    const unknownFields = Object.keys(input).filter((field) => !allowedInput.has(field));
    if (unknownFields.length) {
      throw new AppError("El cuerpo contiene campos no permitidos", 422, "UNKNOWN_FIELDS", unknownFields);
    }

    const payload = await this.validator.validate(this.schemas[operation], input, {
      partial: operation === "update",
      context,
    });

    for (const customValidator of this.validators[operation] || []) {
      await customValidator(payload, context);
    }

    return payload;
  }

  #sanitizePayload(payload) {
    const allowed = new Set(this.writableFields);
    return Object.fromEntries(Object.entries(payload).filter(([key]) => allowed.has(key)));
  }

  #applyTenant(payload, context) {
    if (
      this.model.rawAttributes.tenant_id &&
      context.auth?.tenantId &&
      context.allowUnscoped !== true
    ) {
      payload.tenant_id = context.auth.tenantId;
    }
  }

  async #buildWhere(query, context) {
    const where = await this.#scopeWhere(context);

    for (const field of this.filterableFields) {
      if (RESERVED_QUERY_FIELDS.has(field) || query[field] === undefined) continue;
      where[field] = this.#coerceValue(field, query[field]);
    }

    if (query.search && this.searchableFields.length) {
      where[Op.or] = this.searchableFields.map((field) => ({
        [field]: { [Op.iLike]: `%${String(query.search).slice(0, 100)}%` },
      }));
    }

    return where;
  }

  async #scopeWhere(context) {
    const customScope = this.scope ? await this.scope(context) : {};
    if (
      this.model.rawAttributes.tenant_id &&
      context.auth?.tenantId &&
      context.allowUnscoped !== true
    ) {
      return { ...customScope, tenant_id: context.auth.tenantId };
    }
    return customScope || {};
  }

  #buildOrder(query) {
    const requested = query.sort_by;
    const field = requested && this.sortableFields.includes(requested) ? requested : this.defaultSort[0];
    const direction = String(query.sort_dir || this.defaultSort[1]).toUpperCase() === "ASC" ? "ASC" : "DESC";
    return [[field, direction]];
  }

  #coerceValue(field, value) {
    const type = this.model.rawAttributes[field]?.type?.key;
    if (type === "BOOLEAN") {
      if (String(value).toLowerCase() === "true") return true;
      if (String(value).toLowerCase() === "false") return false;
    }
    if (["INTEGER", "BIGINT", "FLOAT", "DOUBLE", "DECIMAL"].includes(type)) {
      const number = Number(value);
      if (!Number.isNaN(number)) return number;
    }
    return value;
  }

  #positiveInt(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
  }

  #inferWritableFields() {
    return Object.entries(this.model.rawAttributes)
      .filter(([, attribute]) => !attribute.primaryKey && !attribute.autoIncrement && !attribute._autoGenerated)
      .map(([name]) => name)
      .filter((name) => !["created_at", "updated_at", "external_id", "tenant_id"].includes(name));
  }

  #modelResource() {
    const table = this.model.getTableName();
    return typeof table === "string" ? table : table.tableName;
  }

  #sanitizeOutput(value, preserveContent = false) {
    if (preserveContent || value === null || value === undefined) return value;
    if (Array.isArray(value)) return value.map((item) => this.#sanitizeOutput(item));
    if (typeof value !== "object" || value instanceof Date) return value;

    const preservedContentFields = new Set([
      "metadata",
      "calibration",
      "source_payload",
      "details",
      "value_json",
    ]);
    const output = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      const internalForeignKey =
        key.endsWith("_id") &&
        key !== "external_id" &&
        !key.endsWith("_external_id") &&
        key !== "request_id";
      if (
        this.hiddenFields.has(key) ||
        internalForeignKey ||
        ["password_hash", "token_hash"].includes(key)
      ) {
        continue;
      }
      output[key] = this.#sanitizeOutput(nestedValue, preservedContentFields.has(key));
    }
    return output;
  }

  async #withTransaction(context, callback) {
    if (context.transaction) return callback(context.transaction);
    return this.model.sequelize.transaction(callback);
  }
}

module.exports = AutoCrudService;
