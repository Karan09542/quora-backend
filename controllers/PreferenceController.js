const { CatchAsync } = require("../ErrorHandling/utils");
const Preference = require("../models/PreferencesModel");
const AppError = require("../ErrorHandling/AppError");

// notification-preferences
exports.getNotificationPreferencesController = CatchAsync(
  async (req, res, next) => {
    const userId = req.userId;
    const preferences = await Preference.findOne({ userId }).select(
      "notification"
    );
    if (!preferences) {
      return next(new AppError("Preferences not found", 404));
    }
    res.status(200).json({
      status: "success",
      notification: preferences.notification,
    });
  }
);
exports.updateNotificationPreferencesController = CatchAsync(
  async (req, res, next) => {
    const { preferences } = req.body;
    const userId = req.userId;
    console.log({ preferences });
    if (!preferences) {
      return next(new AppError("Please provide preferences", 400));
    }
    const updatedPreferences = {};
    const preferencesKeys = [
      "isEmailOnNewAnswers",
      "isEmailOnSomeoneRequestsToAnswer",
      "isMessages",
      "isCommentsAndReplies",
      "isMentions",
      "isSpaceInvites",
      "isSpaceUpdates",
      "isMightLike",
      "isEmailOnNewFollowers",
      "isEmailOnUpvotes",
      "isEmailOnSharesMyContent",
      "isEmailOnModerationMyAnswers",
      "isEmailOnTopStories",
      "digestFrequency",
      "isEmailOnAnswersAndShares",
      "isEmailOnStories",
      "isEmailRecommendedQuestions",
    ];
    Object.keys(preferences).forEach((key) => {
      if (preferencesKeys.includes(key) && preferences[key] !== undefined) {
        updatedPreferences[key] = preferences[key];
      }
    });

    await Preference.findOneAndUpdate({ userId }, [
      {
        $set: {
          notification: {
            $mergeObjects: ["$notification", updatedPreferences],
          },
        },
      },
    ]);

    res.status(200).json({
      status: "success",
      message: "Preferences updated successfully",
    });
  }
);
