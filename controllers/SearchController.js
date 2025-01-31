const { ObjectId } = require("mongoose").Types;
const { CatchAsync } = require("../ErrorHandling/utils");

const {
  getQuestions,
  getAnswers,
  getProfiles,
} = require("../utility/getDocuments");

exports.getSearchController = CatchAsync(async (req, res, next) => {
  const { q, type, author, time } = req.query;
  const userId = new ObjectId(req.userId);

  let results = [];
  let questions = [];
  let answers = [];

  if (!type && !author && !time) {
    // search in questions
    let questions = await getQuestions({ q, userId });
    if (questions.length === 0) {
      questions = await getQuestions({ q, isFullText: false });
    }

    // search answers on posts
    let answers = await getAnswers({ q, userId });
    if (answers.length === 0) {
      answers = await getAnswers({
        q,
        userId,
        isFullText: false,
      });
    }
    // [questions, answers] = await Promise.all([questions, answers]);
    let results = [...questions, ...answers];

    return res.status(200).json({
      status: "success",
      results,
    });
  }

  if (type) {
    switch (type) {
      case "question": {
        questions = await getQuestions({ q, userId });
        if (questions.length === 0) {
          questions = await getQuestions({ q, userId, isFullText: false });
        }
        results = [...questions];
        break;
      }
      case "answer": {
        answers = await getAnswers({
          q,
          userId,
          exclude: { questionId: { $exists: true } },
        });
        if (answers.length === 0) {
          answers = await getAnswers({
            q,
            userId,
            isFullText: false,
            exclude: { questionId: { $exists: true } },
          });
        }
        results = [...answers];
        break;
      }
      case "post": {
        results = await getAnswers({
          q,
          userId,
          exclude: { questionId: { $exists: false } },
        });
        if (results.length === 0) {
          results = await getAnswers({
            q,
            userId,
            isFullText: false,
            exclude: { questionId: { $exists: false } },
          });
        }
        break;
      }

      case "profile": {
        results = await getProfiles({ q, userId });
        break;
      }
      default:
        break;
    }
  }
  res.status(200).json({
    status: "success",
    results,
  });
});

exports.getProfileData = () => {
  return CatchAsync(async (req, res, next) => {});
};
