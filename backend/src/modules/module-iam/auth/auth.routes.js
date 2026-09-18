const express = require("express");
const authController = require("./auth.controller");
const { authenticateBearer } = require("../../../middleware/authentication");

const router = express.Router();
router.post("/login", (req, res) => authController.login(req, res));
router.get("/me", authenticateBearer, (req, res) => authController.me(req, res));
router.post("/logout", authenticateBearer, (req, res) => authController.logout(req, res));

module.exports = router;
