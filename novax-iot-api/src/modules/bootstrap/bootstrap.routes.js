const express = require("express");
const bootstrapController = require("./bootstrap.controller");

const router = express.Router();
router.post("/", (req, res) => bootstrapController.create(req, res));

module.exports = router;

