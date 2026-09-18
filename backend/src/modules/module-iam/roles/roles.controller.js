const { AutoCrudController } = require("../../../helpers/autoCrud");
const roleService = require("./roles.service");
const handleError = require("../../../utils/handleError/handleError");

class RoleController extends AutoCrudController {
  constructor() {
    super(roleService);
    this.setPermissions = this.setPermissions.bind(this);
  }

  async setPermissions(req, res) {
    try {
      const data = await roleService.setPermissions(
        req.params.external_id,
        req.body.permission_keys,
        this.context(req),
      );
      return res.json({ data });
    } catch (error) {
      return handleError(error, res);
    }
  }
}

module.exports = new RoleController();

