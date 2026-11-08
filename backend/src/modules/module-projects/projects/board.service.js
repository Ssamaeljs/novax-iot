const { Op } = require("sequelize");
const { sequelize, Project, ProjectWidget, ProjectWidgetSensor, Sensor } = require("../../../config/models");
const projects = require("./projects.service");
const { validateBoard, assertLockedLayout } = require("./board.validation");
const AppError = require("../../../utils/handleError/AppError");
const { recordAudit } = require("../../module-audit/auditLogs/auditWriter");

function sensorPublic(sensor) {
  return { external_id: sensor.external_id, name: sensor.name, key: sensor.key, metric: sensor.metric, unit: sensor.unit, data_type: sensor.data_type, is_active: sensor.is_active };
}
async function activeProject(externalId, context, transaction, lock = false) {
  const project = await projects.findRecord(externalId, context, { transaction, include: [] });
  if (!project.is_active) throw new AppError("El proyecto está desactivado", 409, "PROJECT_INACTIVE");
  if (!lock) return project;
  // Lock the row before reading its version or replacing any widget.
  return Project.findOne({ where: { id: project.id, tenant_id: context.auth.tenantId, is_active: true }, transaction, lock: transaction.LOCK.UPDATE });
}
async function widgetsFor(project, context, transaction) {
  return ProjectWidget.findAll({
    where: { project_id: project.id, tenant_id: context.auth.tenantId },
    include: [{ model: Sensor, as: "sensors", through: { attributes: ["position"] }, where: { tenant_id: context.auth.tenantId }, required: false }],
    order: [["y", "ASC"], ["x", "ASC"], ["id", "ASC"]], transaction,
  });
}
function publicWidget(widget) {
  const sensors = [...widget.sensors].sort((a, b) => a.ProjectWidgetSensor.position - b.ProjectWidgetSensor.position);
  return {
    external_id: widget.external_id, title: widget.title, type: widget.type,
    layout: { x: widget.x, y: widget.y, width: widget.width, height: widget.height, locked: widget.locked },
    settings: widget.settings, sensor_external_ids: sensors.map((sensor) => sensor.external_id), sensors: sensors.map(sensorPublic),
  };
}
async function read(externalId, context) {
  const project = await activeProject(externalId, context, context.transaction);
  const widgets = await widgetsFor(project, context, context.transaction);
  await recordAudit({ context, action: "READ", resource: "project_boards", resourceId: externalId, transaction: context.transaction });
  return { project: projects.serialize(project), version: project.version, widgets: widgets.map(publicWidget) };
}
async function save(externalId, input, context) {
  const board = validateBoard(input);
  return sequelize.transaction(async (transaction) => {
    const project = await activeProject(externalId, context, transaction, true);
    if (!project) throw new AppError("El proyecto no está disponible", 409, "PROJECT_INACTIVE");
    if (project.version !== board.version) throw new AppError("Otra persona modificó el tablero. Recarga antes de guardar.", 409, "BOARD_VERSION_CONFLICT");
    const current = await ProjectWidget.findAll({ where: { project_id: project.id, tenant_id: context.auth.tenantId }, transaction });
    const byPublicId = new Map(current.map((widget) => [widget.external_id, widget]));
    const sensorIds = [...new Set(board.widgets.flatMap((widget) => widget.sensor_external_ids))];
    const sensors = await Sensor.findAll({ where: { external_id: sensorIds, tenant_id: context.auth.tenantId, is_active: true }, transaction });
    if (sensors.length !== sensorIds.length) throw new AppError("Uno o más sensores no están disponibles en NOVAX", 422, "INVALID_WIDGET_SENSORS");
    const sensorMap = new Map(sensors.map((sensor) => [sensor.external_id, sensor]));
    for (const widget of board.widgets) {
      if (widget.external_id && !byPublicId.has(widget.external_id)) throw new AppError("Widget no encontrado en este proyecto", 404, "WIDGET_NOT_FOUND");
      if (widget.external_id) assertLockedLayout(byPublicId.get(widget.external_id), widget.layout);
      const selected = widget.sensor_external_ids.map((id) => sensorMap.get(id));
      if ((widget.settings.color_rules || []).some((rule) => sensorMap.get(rule.sensor_external_id).data_type !== "NUMBER")) throw new AppError("Las condiciones de color requieren sensores numéricos", 422, "NUMERIC_SENSOR_REQUIRED");
      if (widget.type !== "HTML" && selected.some((sensor) => sensor.data_type !== "NUMBER")) throw new AppError("Los gráficos requieren sensores numéricos", 422, "NUMERIC_SENSOR_REQUIRED");
      if (widget.type === "TIMELINE" && selected.some((sensor) => sensor.unit !== selected[0].unit || sensor.metric !== selected[0].metric)) throw new AppError("La comparación requiere la misma métrica y unidad", 422, "INCOMPATIBLE_WIDGET_SENSORS");
    }
    const kept = [];
    for (const widget of board.widgets) {
      const payload = { title: widget.title, type: widget.type, ...widget.layout, settings: widget.settings };
      const record = widget.external_id ? await byPublicId.get(widget.external_id).update(payload, { transaction }) : await ProjectWidget.create({ ...payload, project_id: project.id, tenant_id: context.auth.tenantId }, { transaction });
      kept.push(record.id);
      await ProjectWidgetSensor.destroy({ where: { widget_id: record.id }, transaction });
      await ProjectWidgetSensor.bulkCreate(widget.sensor_external_ids.map((id, position) => ({ widget_id: record.id, sensor_id: sensorMap.get(id).id, position })), { transaction });
    }
    await ProjectWidget.destroy({ where: { project_id: project.id, tenant_id: context.auth.tenantId, ...(kept.length ? { id: { [Op.notIn]: kept } } : {}) }, transaction });
    await project.update({ version: project.version + 1 }, { transaction });
    await recordAudit({ context, action: "UPDATE", resource: "project_boards", resourceId: externalId, details: { widget_count: board.widgets.length, version: project.version }, transaction });
    return { project: projects.serialize(project), version: project.version, widgets: (await widgetsFor(project, context, transaction)).map(publicWidget) };
  });
}
module.exports = { read, save, activeProject, widgetsFor, sensorPublic };
