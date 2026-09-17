const { AutoCrudController } = require("../../../helpers/autoCrud");
const measurementService = require("./measurements.service");
const handleError = require("../../../utils/handleError/handleError");

class MeasurementController extends AutoCrudController {
  constructor() {
    super(measurementService);
    this.bulkCreate = this.bulkCreate.bind(this);
  }

  async bulkCreate(req, res) {
    try {
      const data = await measurementService.bulkCreate(req.body.measurements, this.context(req));
      return res.status(201).json({ data });
    } catch (error) {
      return handleError(error, res);
    }
  }
}

module.exports = new MeasurementController();

