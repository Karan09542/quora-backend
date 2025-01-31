const Post = require("../models/PostModel");
const Question = require("../models/QuestionModel");
const User = require("../models/UserModel");

exports.getQuestions = async ({
  q,
  userId,
  isFullText = true,
  isSearch = true,
  sort = 1,
}) => {
  let search;
  if (!isSearch) {
    search = q;
  } else {
    search = isFullText
      ? { $text: { $search: q } }
      : { searchText: { $regex: q, $options: "i" } };
  }
  return await Question.aggregate([
    {
      $match: {
        ...search,
        isPublic: true,
      },
    },
    {
      $sort: {
        createdAt: sort,
      },
    },
    // lookup on current user
    // {
    //   $lookup: {
    //     from: "users",
    //     let: { questionCreatorId: "$createdBy._id" },
    //     pipeline: [
    //       {
    //         $match: { _id: userId },
    //       },
    //       {
    //         $addFields: {
    //           isFollowing: {
    //             $in: ["$$questionCreatorId", "$following"],
    //           },
    //         },
    //       },
    //       // {
    //       //   $project: {
    //       //     isFollowing: 1,
    //       //     _id: 0,
    //       //   },
    //       // },
    //     ],
    //     as: "currentUser",
    //   },
    // },
    // {
    //   $addFields: {
    //     currentUser: {
    //       $arrayElemAt: ["$currentUser", 0],
    //     },
    //   },
    // },
    // lookup on createdBy
    {
      $lookup: {
        from: "users",
        localField: "createdBy",
        foreignField: "_id",
        as: "createdBy",
      },
    },
    {
      $addFields: {
        createdBy: {
          $arrayElemAt: ["$createdBy", 0],
        },
      },
    },
    {
      $addFields: {
        type: "question",
        isOwnQuestion: {
          $eq: [userId, "$createdBy._id"],
        },
        totalAnswers: { $size: { $ifNull: ["$answers", []] } },
        isDownvoted: { $in: [userId, { $ifNull: ["$downvotes", []] }] },
        totalFollowers: { $size: { $ifNull: ["$createdBy.followers", []] } },
        isFollowing: {
          $in: [userId, { $ifNull: ["$createdBy.followers", []] }],
        },

        createdBy: {
          $let: {
            vars: {
              createdByObj: {
                $ifNull: ["$createdBy", {}],
              },
            },
            in: {
              $arrayToObject: {
                $filter: {
                  input: { $objectToArray: "$$createdByObj" },
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
                          "followers",
                          "following",
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
                        ],
                      ],
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    // lookup on posts that current user has answered or not
    {
      $lookup: {
        from: "posts",
        localField: "answers",
        foreignField: "_id",
        let: { currentAnswer: "$answers" },
        pipeline: [
          {
            $match: {
              $expr: {
                $eq: [userId, "$createdBy"],
              },
            },
          },
          {
            $project: {
              _id: 1,
            },
          },
        ],
        as: "allAnswer",
      },
    },
    {
      $addFields: {
        isAnswered: {
          $cond: {
            if: {
              $eq: [{ $size: "$allAnswer" }, 0],
            },
            then: false,
            else: true,
          },
        },
      },
    },

    {
      $project: {
        answers: 0,
        __v: 0,
        downvotes: 0,
        isPublic: 0,
        allAnswer: 0,
      },
    },
  ]);
};
exports.getAnswers = async ({
  q,
  userId,
  isFullText = true,
  exclude = {},
  isSearch = true,
  sort = 1,
}) => {
  let search;
  if (!isSearch) {
    search = q;
  } else {
    search = isFullText
      ? { $text: { $search: q } }
      : { searchText: { $regex: q, $options: "i" } };
  }
  return await Post.aggregate([
    {
      $match: {
        ...search,
        ...exclude,
        isDeleted: false,
        isPublished: true,
      },
    },
    // sort by createdAt
    {
      $sort: {
        createdAt: sort,
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
                $eq: ["$_id", userId],
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
    // lookup to createdBy of answer
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
            if: { $in: [userId, { $ifNull: ["$upvotes", []] }] },
            then: true,
            else: false,
          },
        },
        isDownvoted: {
          $cond: {
            if: { $in: [userId, { $ifNull: ["$downvotes", []] }] },
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
                  $in: ["$_id", { $ifNull: ["$currentUser.bookmarks", []] }],
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
                  $in: [
                    "$createdBy._id",
                    { $ifNull: ["$currentUser.following", []] },
                  ],
                },
              ],
            },

            then: true,
            else: false,
          },
        },
        ram: "$createdBy.followers",
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
      },
    },
  ]);
};

exports.getProfiles = async ({ q, userId }) => {
  return await User.aggregate([
    {
      $match: {
        $or: [
          { username: { $regex: q, $options: "i" } },
          { "credentials.employment": { $regex: q, $options: "i" } },
        ],
      },
    },
    {
      $project: {
        _id: 1,
        username: 1,
        credentials: 1,
        profilePicture: 1,
        totalFollowers: { $size: { $ifNull: ["$followers", []] } },
        isFollowing: {
          $cond: {
            if: {
              $in: [userId, { $ifNull: ["$followers", []] }],
            },
            then: true,
            else: false,
          },
        },
        isOwnProfile: {
          $cond: {
            if: {
              $eq: [userId, "$_id"],
            },
            then: true,
            else: false,
          },
        },
        type: "profile",
        createdAt: 1,
      },
    },
  ]);
};
