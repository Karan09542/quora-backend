const mongoose = require("mongoose");

const preferenceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  notification: {
    isEmailOnNewAnswers: { type: Boolean, default: true },
    isEmailOnSomeoneRequestsToAnswer: { type: Boolean, default: true },
    isMessages: { type: Boolean, default: true },
    isCommentsAndReplies: { type: Boolean, default: true },
    isMentions: { type: Boolean, default: true },
    isSpaceInvites: { type: Boolean, default: true },
    isSpaceUpdates: { type: Boolean, default: true },
    isMightLike: { type: Boolean, default: true },
    isEmailOnNewFollowers: { type: Boolean, default: true },
    isEmailOnUpvotes: { type: Boolean, default: true },
    isEmailOnSharesMyContent: { type: Boolean, default: true },
    isEmailOnModerationMyAnswers: { type: Boolean, default: true },
    isEmailOnTopStories: { type: Boolean, default: true },
    digestFrequency: {
      type: String,
      enum: ["asAvailable", "daily", "weekly"],
      default: "asAvailable",
    },
    isEmailOnAnswersAndShares: { type: Boolean, default: true },
    isEmailOnStories: { type: Boolean, default: true },
    isEmailRecommendedQuestions: { type: Boolean, default: true },
  },
});

const Preference = mongoose.model("Preference", preferenceSchema);
module.exports = Preference;
