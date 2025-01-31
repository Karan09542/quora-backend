const express = require("express");
const { authorize } = require("../controllers/UserController");
const {
  addCommentController,
  getCommentsController,
  handleUpvote,
  handleDownvote,
  getCommentsFromCommentIdController,
} = require("../controllers/CommentController");

// private comment
const PrivateCommentRouter = express.Router();
PrivateCommentRouter.use(authorize);
PrivateCommentRouter.post("/add", addCommentController);
// handle upvote and downvote
PrivateCommentRouter.post("/handle-upvote", handleUpvote);
PrivateCommentRouter.post("/handle-downvote", handleDownvote);

// public comment
const PublicCommentRouter = express.Router();
PublicCommentRouter.get("/:postId/:userId", getCommentsController);
PublicCommentRouter.get("/:commentId", getCommentsFromCommentIdController);

module.exports = { PrivateCommentRouter, PublicCommentRouter };
