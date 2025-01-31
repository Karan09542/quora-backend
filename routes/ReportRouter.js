const express = require("express");
const { authorize } = require("../controllers/UserController");
const { report } = require("../controllers/ReporterController");

const ReporterRouter = express.Router();

ReporterRouter.post("/", authorize, report);
module.exports = ReporterRouter;
