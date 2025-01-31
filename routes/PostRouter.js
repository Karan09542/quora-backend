const express = require("express");
const {
  PostController,
  getDraftsController,
  handleUpvote,
  handleDownvote,
  deleteAnswersController,
} = require("../controllers/PostController");
const { authorize } = require("../controllers/UserController");

const PostRouter = express.Router();
PostRouter.use(authorize);
PostRouter.post("/", PostController());
PostRouter.post("/draft", getDraftsController);

// handle upvote and downvote
PostRouter.post("/handle-upvote", handleUpvote);
PostRouter.post("/handle-downvote", handleDownvote);

// handle delete answers
PostRouter.post("/delete-answer", deleteAnswersController);

module.exports = PostRouter;
