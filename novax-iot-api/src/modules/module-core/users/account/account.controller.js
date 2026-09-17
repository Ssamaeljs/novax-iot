const { AutoCrudController } = require("../../../../helpers/autoCrud");
const accountService = require("./account.service");
const handleError = require("../../../../utils/handleError/handleError");

class AccountController extends AutoCrudController {
  constructor() {
    super(accountService);
    this.setRoles = this.setRoles.bind(this);
  }

  async setRoles(req, res) {
    try {
      const data = await accountService.setRoles(req.params.id, req.body.role_external_ids, this.context(req));
      return res.json({ data });
    } catch (error) {
      return handleError(error, res);
    }
  }
}

module.exports = new AccountController();

