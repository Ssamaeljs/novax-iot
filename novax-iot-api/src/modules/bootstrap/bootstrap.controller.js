const bootstrapService = require("./bootstrap.service");
const handleError = require("../../utils/handleError/handleError");

class BootstrapController {
  async create(req, res) {
    try {
      const data = await bootstrapService.execute(req.body, req.get("x-bootstrap-secret"));
      return res.status(201).json({ data });
    } catch (error) {
      return handleError(error, res);
    }
  }
}

module.exports = new BootstrapController();

