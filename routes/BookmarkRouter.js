const express = require("express");
const { authorize } = require("../controllers/UserController");
const { getBookmarksController } = require("../controllers/BookmarkController");

const BookmarkRouter = express.Router();
BookmarkRouter.use(authorize);

BookmarkRouter.post("/", getBookmarksController);

module.exports = BookmarkRouter;
