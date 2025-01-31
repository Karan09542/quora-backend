const express = require("express");
const {
  addQuestionController,
  getQuestionsRequestFromQuoraController,
  getQuestionsWithAnswersController,
  getDraftQuestionsController,
  handleDownvote,
} = require("../controllers/QuestionController");
const { authorize } = require("../controllers/UserController");
const {
  getQuestionWithAllAnswersController,
} = require("../controllers/DynmaciQuestionController");

const QuestionRouter = express.Router();

QuestionRouter.post("/", authorize, getQuestionsWithAnswersController);
QuestionRouter.post(
  "/quora-questions",
  authorize,
  getQuestionsRequestFromQuoraController
);
QuestionRouter.post("/create", authorize, addQuestionController);
QuestionRouter.post("/handle-downvote", authorize, handleDownvote);

QuestionRouter.get("/:question", getQuestionWithAllAnswersController);

module.exports = QuestionRouter;
