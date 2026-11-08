const { AutoCrudService } = require("../../../helpers/autoCrud");
const { IntegrationMessage } = require("../../../config/models");
class MessageService extends AutoCrudService {
  constructor() { super({ model: IntegrationMessage, defaultSort: ["received_at", "DESC"] }); }
  serialize(record) {
    return { external_id: record.external_id, message_id: record.message_id, received_at: record.received_at, reading_count: record.reading_count, normalized: record.normalized };
  }
}
module.exports = new MessageService();
