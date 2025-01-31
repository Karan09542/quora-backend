const { CatchAsync } = require("../ErrorHandling/utils");
const Question = require("../models/QuestionModel");
const Post = require("../models/PostModel");
const User = require("../models/UserModel");
const AppError = require("../ErrorHandling/AppError");
const { ObjectId } = require("mongoose").Types;
exports.PostController = (isPublished = true) => {
  return CatchAsync(async (req, res, next) => {
    const {
      content,
      createdBy,
      spaces,
      upvotes,
      downvotes,
      images,
      comments,
      questionId,
      searchText,
    } = req.body;
    const userId = req.userId;
    if (!content && !createdBy && !questionId && !searchText) {
      return next(new AppError("Please provide required fields", 400));
    }
    if (images) {
    }
    let contentType = "post";
    if (questionId) {
      contentType = "answer";
      // check is already an answer
      const isAlreadyAnswered = await Post.exists({
        questionId,
        createdBy: userId,
      });
      if (isAlreadyAnswered) {
        return next(new AppError("You have already answered", 400));
      }
    }
    const newPost = await Post.create({
      content: JSON.stringify(content),
      createdBy: userId,
      spaces,
      upvotes,
      downvotes,
      images,
      comments,
      isPublished: isPublished,
      questionId: questionId || undefined,
      searchText,
      contentType,
    });

    // add post to question
    if (questionId) {
      await Question.findOneAndUpdate(
        { _id: questionId },
        { $push: { answers: newPost._id } }
      );
    }
    await User.findOneAndUpdate(
      { _id: userId },
      { $push: { posts: newPost._id } }
    );
    // console.log("question", question);

    res.status(200).json({
      status: "success",
      message: `${questionId ? "Answer" : "Post"} created successfully`,
    });
  });
};

exports.getDraftsController = CatchAsync(async (req, res, next) => {
  const userId = req.userId;
  const drafts = await Post.find({ createdBy: userId, isPublished: false });
  res.status(200).json({
    status: "success",
    drafts,
  });
});

exports.handleUpvote = CatchAsync(async (req, res, next) => {
  const { postId } = req.body;
  const userId = req.userId;

  const post = await Post.findById(postId);
  if (!post) {
    return next(new AppError("Post not found", 404));
  }

  if (userId === post?.createdBy?.toString()) {
    return next(new AppError("You cannot upvote your own post", 400));
  }

  const isAlreadyUpvoted = await Post.exists({
    _id: postId,
    upvotes: userId,
  });
  let message;
  if (isAlreadyUpvoted) {
    await Post.findByIdAndUpdate(postId, {
      $pull: { upvotes: userId, downvotes: userId },
    });
    message = "Removed upvote";
  } else {
    await Post.findByIdAndUpdate(postId, {
      $addToSet: { upvotes: userId },
      $pull: { downvotes: userId },
    });
    message = "Upvoted successfully";
  }
  return res.status(200).json({
    status: "success",
    message,
  });
});
exports.handleDownvote = CatchAsync(async (req, res, next) => {
  const { postId } = req.body;
  const userId = req.userId;
  const post = await Post.findById(postId);
  if (!post) {
    return next(new AppError("Post not found", 404));
  }
  if (userId === post?.createdBy?.toString()) {
    return next(new AppError("You cannot downvote your own post", 400));
  }

  const isAlreadyDownvoted = await Post.findOne({
    _id: postId,
    downvotes: userId,
  });

  let message;

  if (isAlreadyDownvoted) {
    await Post.findByIdAndUpdate(postId, {
      $pull: { upvotes: userId, downvotes: userId },
    });
    message = "Removed downvote";
  } else {
    await Post.findByIdAndUpdate(postId, {
      $addToSet: { downvotes: userId },
      $pull: { upvotes: userId },
    });
    message = "Downvoted successfully";
  }

  return res.status(200).json({
    status: "success",
    message,
  });
});
// exports.updatePostController = CatchAsync(async (req, res, next) => {
//   const { upvotes, downvotes, postId } = req.body;
//   const userId = req.userId;

//   const post = await Post.findOneAndUpdate(
//     { _id: req.params.id },
//     { $set: { upvotes, downvotes } },
//     { new: true }
//   );
// });
exports.deleteAnswersController = CatchAsync(async (req, res, next) => {
  const userId = req.userId;
  const { answerId } = req.body;
  if (!answerId) {
    return next(new AppError("Please provide answerId", 400));
  }

  // check if answer exists
  const answer = await Post.findById(answerId);
  if (!answer) {
    return next(new AppError("Answer not found", 404));
  }
  if (answer.createdBy.toString() !== userId) {
    return next(new AppError("You are not allowed to delete this answer", 403));
  }

  // remove answer id from question
  const isQuestion = await Question.findByIdAndUpdate(answer?.questionId, {
    $pull: { answers: answer?._id },
  });

  // update answer isDeleted
  answer.isDeleted = true;
  answer.deletedAt = new Date();
  await answer.save({ validateBeforeSave: false });

  res.status(200).json({
    status: "success",
    message: `successfully deleted the ${answer?.contentType}`,
  });
});
