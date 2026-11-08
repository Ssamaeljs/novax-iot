const { AutoCrudController } = require("../../../helpers/autoCrud");
const projects = require("./projects.service");
const board = require("./board.service");
const telemetry = require("./telemetry.service");
const handleError = require("../../../utils/handleError/handleError");
class ProjectsController extends AutoCrudController {
  constructor() { super(projects); }
  async readBoard(req, res) {
    try { return res.json({ data: await board.read(req.params.external_id, this.context(req)) }); }
    catch (error) { return handleError(error, res); }
  }
  async saveBoard(req, res) {
    try { return res.json({ data: await board.save(req.params.external_id, req.body, this.context(req)) }); }
    catch (error) { return handleError(error, res); }
  }
  async telemetry(req, res) {
    try { return res.json({ data: await telemetry.read(req.params.external_id, req.query, this.context(req)) }); }
    catch (error) { return handleError(error, res); }
  }
}
module.exports = new ProjectsController();
