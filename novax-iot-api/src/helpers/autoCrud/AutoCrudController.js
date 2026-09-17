const handleError = require("../../utils/handleError/handleError");

class AutoCrudController {
  constructor(service) {
    this.service = service;
    this.list = this.list.bind(this);
    this.get = this.get.bind(this);
    this.create = this.create.bind(this);
    this.update = this.update.bind(this);
    this.delete = this.delete.bind(this);
  }

  context(req) {
    return { auth: req.auth, requestId: req.requestId };
  }

  async list(req, res) {
    try {
      return res.json(await this.service.list(req.query, this.context(req)));
    } catch (error) {
      return handleError(error, res);
    }
  }

  async get(req, res) {
    try {
      return res.json({ data: await this.service.get(req.params.id, this.context(req)) });
    } catch (error) {
      return handleError(error, res);
    }
  }

  async create(req, res) {
    try {
      return res.status(201).json({ data: await this.service.create(req.body, this.context(req)) });
    } catch (error) {
      return handleError(error, res);
    }
  }

  async update(req, res) {
    try {
      return res.json({ data: await this.service.update(req.params.id, req.body, this.context(req)) });
    } catch (error) {
      return handleError(error, res);
    }
  }

  async delete(req, res) {
    try {
      await this.service.delete(req.params.id, this.context(req));
      return res.status(204).send();
    } catch (error) {
      return handleError(error, res);
    }
  }
}

module.exports = AutoCrudController;

