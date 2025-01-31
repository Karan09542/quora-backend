const express = require("express");
const { authorize } = require("../controllers/UserController");
const { getSearchController } = require("../controllers/SearchController");

const SearchRouter = express.Router();
SearchRouter.use(authorize);

SearchRouter.post("/", getSearchController);

module.exports = SearchRouter;
