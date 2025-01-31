const { CatchAsync } = require("../ErrorHandling/utils");
const User = require("../models/UserModel");
const { ObjectId } = require("mongoose").Types;

exports.getBookmarksController = CatchAsync(async (req, res, next) => {
  const userId = new ObjectId(req.userId);
  const user = await User.findById(userId).select("_id");
  if (!user) {
    return next(new AppError("User not found", 404));
  }
  const bookmarks = await User.aggregate([
    {
      $match: {
        _id: user._id,
      },
    },
    {
      $lookup: {
        from: "posts",
        localField: "bookmarks",
        foreignField: "_id",
        as: "bookmarks",
      },
    },
    // unpack bookmarks
    {
      $unwind: "$bookmarks",
    },
    {
      $replaceRoot: {
        newRoot: "$bookmarks",
      },
    },
    // lookup on comments for total comments for each post
    {
      $lookup: {
        from: "comments",
        let: { postId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: ["$postId", "$$postId"],
              },
            },
          },
          {
            $group: {
              _id: null,
              totalComments: { $sum: 1 },
            },
          },
          {
            $project: {
              totalComments: 1,
              _id: 0,
            },
          },
        ],
        as: "commentsData",
      },
    },
    // lookup on current user
    {
      $lookup: {
        from: "users",
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: ["$_id", user._id],
              },
            },
          },
          {
            $project: {
              following: 1,
              bookmarks: 1,
              _id: 0,
            },
          },
        ],
        as: "currentUser",
      },
    },
    // current user without array
    {
      $addFields: {
        currentUser: {
          $arrayElemAt: ["$currentUser", 0],
        },
      },
    },
    // lookup to createdBy answer of bookmark
    {
      $lookup: {
        from: "users",
        localField: "createdBy",
        foreignField: "_id",
        as: "createdBy",
      },
    },
    // createdBy without array
    {
      $addFields: {
        createdBy: {
          $arrayElemAt: ["$createdBy", 0],
        },
      },
    },
    // add fields i.e. upvote, downvote
    {
      $addFields: {
        type: "answer",
        totalUpvotes: { $size: { $ifNull: ["$upvotes", []] } },
        totalDownvotes: {
          $size: { $ifNull: ["$downvotes", []] },
        },
        isUpvoted: {
          $cond: {
            if: { $in: [userId, "$upvotes"] },
            then: true,
            else: false,
          },
        },
        isDownvoted: {
          $cond: {
            if: { $in: [userId, "$downvotes"] },
            then: true,
            else: false,
          },
        },
        isBookmarked: {
          $cond: {
            if: {
              $and: [
                {
                  $ne: ["$currentUser.bookmarks", null],
                },
                {
                  $ne: ["$currentUser.bookmarks", undefined],
                },
                { $ne: ["$currentUser.bookmarks", []] },

                {
                  $in: ["$_id", "$currentUser.bookmarks"],
                },
              ],
            },
            then: true,
            else: false,
          },
        },
        isOwnContent: {
          $cond: {
            if: {
              $eq: ["$createdBy._id", userId],
            },

            then: true,
            else: false,
          },
        },
        isFollowing: {
          $cond: {
            if: {
              $and: [
                {
                  $ne: ["$currentUser.following", []],
                },
                {
                  $in: ["$createdBy._id", "$currentUser.following"],
                },
              ],
            },

            then: true,
            else: false,
          },
        },
        // ram: "$createdBy.followers",
        totalFollowers: {
          $size: {
            $ifNull: ["$createdBy.followers", []],
          },
        },
        totalComments: {
          $ifNull: [{ $arrayElemAt: ["$commentsData.totalComments", 0] }, 0],
        },
      },
    },
    // lookup and add question data
    {
      $lookup: {
        from: "questions",
        localField: "questionId",
        foreignField: "_id",
        as: "questionData",
      },
    },
    // add question data without array
    {
      $addFields: {
        questionData: { $arrayElemAt: ["$questionData", 0] },
      },
    },
    // add fields to question data
    {
      $addFields: {
        totalAnswers: {
          $cond: {
            if: { $ne: [{ $type: "$questionData" }, "missing"] },
            then: { $size: "$questionData.answers" },
            else: "$$REMOVE",
          },
        },
        itsOwnQuestion: {
          $cond: {
            if: {
              $and: [
                { $ne: [{ $type: "$questionData" }, "missing"] },
                { $eq: [userId, "$questionData.createdBy"] },
              ],
            },
            then: true,
            else: false,
          },
        },
      },
    },
    // question data fields filter
    {
      $addFields: {
        questionData: {
          $cond: {
            if: { $ne: [{ $type: "$questionData" }, "missing"] },
            then: {
              $arrayToObject: {
                $filter: {
                  input: { $objectToArray: "$questionData" },
                  as: "field",
                  cond: {
                    $not: {
                      $in: [
                        "$$field.k",
                        [
                          "answers",
                          "isPublic",
                          "__v",
                          "downvotes",
                          "updatedAt",
                          "createdAt",
                        ],
                      ],
                    },
                  },
                },
              },
            },
            else: "$$REMOVE",
          },
        },
      },
    },
    // filter createdBy fields
    {
      $addFields: {
        createdBy: {
          $arrayToObject: {
            $filter: {
              input: { $objectToArray: "$createdBy" },
              as: "field",
              cond: {
                $not: {
                  $in: [
                    "$$field.k",
                    [
                      "password",
                      "isVerified",
                      "__v",
                      "settings",
                      "passwordChangedAt",
                      "forgotMaxTime",
                      "createdAt",
                      "updatedAt",
                      "forgotFirstTime",
                      "language",
                      "additionalEmails",
                      "refreshToken",
                      "isLoginSecurity",
                      "passwordResetExpires",
                      "passwordResetToken",
                      "passwordVerified",
                      "passwordVerifiedExpires",
                      "preferences",

                      "followers",
                      "following",
                      "posts",
                      "savedPosts",
                      "notifications",
                      "likes",
                      "bookmarks",
                    ],
                  ],
                },
              },
            },
          },
        },
      },
    },
    // projection
    {
      $project: {
        searchText: 0,
        __v: 0,
        downvotes: 0,
        isPublished: 0,
        currentUser: 0,
        commentsData: 0,
      },
    },
  ]);

  res.status(200).json({
    status: "success",
    bookmarks,
  });
});
