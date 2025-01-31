const { CatchAsync } = require("../ErrorHandling/utils");
const Question = require("../models/QuestionModel");
const ObjectId = require("mongoose").Types.ObjectId;

exports.getQuestionWithAllAnswersController = CatchAsync(
  async (req, res, next) => {
    let { question } = req.params;
    let { "x-userid": userId } = req.headers;
    userId = userId !== "undefined" ? new ObjectId(userId) : userId;

    const questions = await Question.aggregate([
      {
        $match: {
          // question: { $regex: question, $options: "i" },
          $expr: {
            $eq: [
              {
                $toLower: {
                  $replaceAll: {
                    input: "$question",
                    find: " ",
                    replacement: "-",
                  },
                },
              },
              { $toLower: question + "?" },
            ],
          },
          answers: { $ne: [] },
          isPublic: true,
        },
      },
      {
        $limit: 1,
      },
      // isOwnQuestion
      {
        $addFields: {
          itsOwnQuestion: {
            $cond: {
              if: {
                $eq: [userId, "$createdBy"],
              },
              then: true,
              else: false,
            },
          },
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
          currentUser: { $arrayElemAt: ["$currentUser", 0] },
        },
      },
      // lookup on answers with createdBy
      {
        $lookup: {
          from: "posts",
          localField: "answers",
          foreignField: "_id",
          let: { letAnswers: "$answers" },
          pipeline: [
            {
              $match: {
                isPublished: true,
              },
            },
            {
              $lookup: {
                from: "users",
                localField: "createdBy",
                foreignField: "_id",
                as: "createdBy",
              },
            },
            {
              $project: {
                isPublished: 0,
                __v: 0,
                deletedAt: 0,
                isDeleted: 0,
              },
            },
            // lookup for comments
            {
              $lookup: {
                from: "comments",
                let: { answerId: "$_id" },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $eq: ["$postId", "$$answerId"],
                      },
                    },
                  },
                  {
                    $group: {
                      _id: "$postId",
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
                as: "commentData",
              },
            },
          ],
          as: "allAnswer",
        },
      },
      // total answers
      {
        $addFields: {
          totalAnswers: { $size: { $ifNull: ["$allAnswer", []] } },
          isFollowing: "$currentUser.isFollowing",
        },
      },
      // all answer
      {
        $addFields: {
          totalAnswers: {
            $size: "$allAnswer",
          },
        },
      },

      // map in all answer
      {
        $addFields: {
          allAnswer: {
            $map: {
              input: "$allAnswer",
              as: "ans",
              in: {
                $mergeObjects: [
                  "$$ans",
                  {
                    totalUpvotes: {
                      $size: { $ifNull: ["$$ans.upvotes", []] },
                    },
                    totalDownvotes: {
                      $size: { $ifNull: ["$$ans.downvotes", []] },
                    },
                    isUpvoted: {
                      $cond: {
                        if: {
                          $in: [userId, { $ifNull: ["$$ans.upvotes", []] }],
                        },
                        then: true,
                        else: false,
                      },
                    },
                    isDownvoted: {
                      $cond: {
                        if: {
                          $in: [userId, { $ifNull: ["$$ans.downvotes", []] }],
                        },
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
                              $in: [
                                "$$ans._id",
                                { $ifNull: ["$currentUser.bookmarks", []] },
                              ],
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
                          $eq: [
                            { $arrayElemAt: ["$$ans.createdBy._id", 0] },
                            userId,
                          ],
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
                              $ne: [
                                { $arrayElemAt: ["$currentUser.following", 0] },
                                [],
                              ],
                            },
                            {
                              $in: [
                                { $arrayElemAt: ["$$ans.createdBy._id", 0] },
                                {
                                  $ifNull: ["$currentUser.following", []],
                                },
                              ],
                            },
                          ],
                        },

                        then: true,
                        else: false,
                      },
                    },

                    totalFollowers: {
                      $size: {
                        $ifNull: [
                          {
                            $arrayElemAt: ["$$ans.createdBy.followers", 0],
                          },
                          [],
                        ],
                      },
                    },
                    totalComments: {
                      $ifNull: [
                        {
                          $arrayElemAt: ["$$ans.commentData.totalComments", 0],
                        },
                        0,
                      ],
                    },

                    createdBy: {
                      $let: {
                        vars: {
                          createdByObj: {
                            $arrayElemAt: ["$$ans.createdBy", 0],
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
                                      "maxUsernameUpdated",
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
                  },
                ],
              },
            },
          },
        },
      },
      // end map

      //   filter answers
      {
        $addFields: {
          allAnswer: {
            $map: {
              input: "$allAnswer",
              as: "ans",
              in: {
                $arrayToObject: {
                  $filter: {
                    input: { $objectToArray: "$$ans" },
                    as: "field",
                    cond: {
                      $not: {
                        $in: [
                          "$$field.k",
                          [
                            "images",
                            "comments",
                            "downvotes",
                            "upvotes",
                            "commentData",
                          ],
                        ],
                      },
                    },
                  },
                },
              },
            },
          },
          totalAnswers: { $size: { $ifNull: ["$allAnswer", []] } },
        },
      },

      // lookup on question createdBy for currentUser if on following
      {
        $lookup: {
          from: "users",
          localField: "createdBy",
          foreignField: "_id",
          pipeline: [
            {
              $limit: 1,
            },
            {
              $project: {
                isFollowing: {
                  $cond: {
                    if: {
                      $in: [userId, { $ifNull: ["$followers", []] }],
                    },
                    then: true,
                    else: false,
                  },
                },
                _id: 0,
              },
            },
          ],
          as: "isFollowing",
        },
      },
      // lookup on posts for isAlreadyAnswer
      {
        $addFields: {
          isAlreadyAnswered: {
            $filter: {
              input: "$allAnswer",
              as: "ans",
              cond: {
                $eq: ["$$ans.createdBy._id", userId],
              },
            },
          },
        },
      },
      // finally avaluate isAlreadyAnswer

      {
        $addFields: {
          isAlreadyAnswered: {
            $cond: {
              if: {
                $gt: [{ $size: "$isAlreadyAnswered" }, 0],
              },
              then: true,
              else: false,
            },
          },
          isFollowing: { $arrayElemAt: ["$isFollowing.isFollowing", 0] },
          isDownvoted: {
            $cond: {
              if: {
                $in: [userId, { $ifNull: ["$downvotes", []] }],
              },
              then: true,
              else: false,
            },
          },
        },
      },
      //   project
      {
        $project: {
          answers: 0,
          //   allAnswer: 0,
          downvotes: 0,
          __v: 0,
          // currentUser: 0,
          isPublic: 0,
          comments: 0,
        },
      },
    ]);
    res.status(200).json({ status: "success", question: questions[0], userId });
  }
);
