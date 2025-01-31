const { get, default: mongoose } = require("mongoose");
const { ObjectId } = require("mongoose").Types;
const { CatchAsync } = require("../ErrorHandling/utils");
const Question = require("../models/QuestionModel");
const User = require("../models/UserModel");
const AppError = require("../ErrorHandling/AppError");

exports.getQuestionsWithAnswersController = CatchAsync(
  async (req, res, next) => {
    let { page, limit } = req.query;
    page = parseInt(page) || 1;
    limit = parseInt(limit) || 10;

    const skip = (page - 1) * limit;
    const userId = new ObjectId(req.userId);

    const questions = await Question.aggregate([
      {
        $match: {
          answers: { $ne: [] },
          isPublic: true,
          $expr: {
            $not: {
              $in: [userId, { $ifNull: ["$downvotes", []] }],
            },
          },
        },
      },
      {
        $skip: skip,
      },
      {
        $limit: limit,
      },
      {
        $sample: {
          size: limit,
        },
      },
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
        },
      },
      // single answer
      {
        $addFields: {
          answer: {
            $arrayElemAt: ["$allAnswer", 0],
          },
        },
      },
      // add fields to answer
      {
        $addFields: {
          answer: {
            $mergeObjects: [
              "$answer",
              {
                totalUpvotes: { $size: { $ifNull: ["$answer.upvotes", []] } },
                totalDownvotes: {
                  $size: { $ifNull: ["$answer.downvotes", []] },
                },
                isUpvoted: {
                  $cond: {
                    if: { $in: [userId, "$answer.upvotes"] },
                    then: true,
                    else: false,
                  },
                },
                isDownvoted: {
                  $cond: {
                    if: { $in: [userId, "$answer.downvotes"] },
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
                          $in: ["$answer._id", "$currentUser.bookmarks"],
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
                        { $arrayElemAt: ["$answer.createdBy._id", 0] },
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
                          $ne: ["$currentUser.following", []],
                        },
                        {
                          $in: [
                            { $arrayElemAt: ["$answer.createdBy._id", 0] },
                            "$currentUser.following",
                          ],
                        },
                      ],
                    },

                    then: true,
                    else: false,
                  },
                },
                totalFollowing: {
                  $size: {
                    $ifNull: [
                      {
                        $arrayElemAt: ["$answer.createdBy.following", 0],
                      },
                      [],
                    ],
                  },
                },
                totalFollowers: {
                  $size: {
                    $ifNull: [
                      { $arrayElemAt: ["$answer.createdBy.followers", 0] },
                      [],
                    ],
                  },
                },
                totalComments: {
                  $ifNull: [
                    { $arrayElemAt: ["$answer.commentData.totalComments", 0] },
                    0,
                  ],
                },

                createdBy: {
                  $let: {
                    vars: {
                      createdByObj: { $arrayElemAt: ["$answer.createdBy", 0] },
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
      // filter answer fields
      {
        $addFields: {
          answer: {
            $arrayToObject: {
              $filter: {
                input: { $objectToArray: "$answer" },
                as: "field",
                cond: {
                  $not: {
                    $in: [
                      "$$field.k",
                      ["searchText", "isPublished", "__v", "commentData"],
                    ],
                  },
                },
              },
            },
          },
        },
      },

      // all answer

      // {
      //   $addFields: {
      //     totalAnswers: {
      //       $size: "$allAnswer",
      //     },
      //     // totalAnswers: {
      //     //   $type: "$allAnswer",
      //     // },
      //   },
      // },

      // map in all answer

      // {
      //   $addFields: {
      //     allAnswer: {
      //       $map: {
      //         input: "$allAnswer",
      //         as: "ans",
      //         in: {
      //           $mergeObjects: [
      //             "$$ans",
      //             {
      //               totalUpvotes: {
      //                 $size: { $ifNull: ["$$ans.upvotes", []] },
      //               },
      //               totalDownvotes: {
      //                 $size: { $ifNull: ["$$ans.downvotes", []] },
      //               },
      //               isUpvoted: {
      //                 $cond: {
      //                   if: {
      //                     $in: [userId, { $ifNull: ["$$ans.upvotes", []] }],
      //                   },
      //                   then: true,
      //                   else: false,
      //                 },
      //               },
      //               isDownvoted: {
      //                 $cond: {
      //                   if: {
      //                     $in: [userId, { $ifNull: ["$$ans.downvotes", []] }],
      //                   },
      //                   then: true,
      //                   else: false,
      //                 },
      //               },
      //               isBookmarked: {
      //                 $cond: {
      //                   if: {
      //                     $and: [
      //                       {
      //                         $ne: ["$currentUser.bookmarks", null],
      //                       },
      //                       {
      //                         $ne: ["$currentUser.bookmarks", undefined],
      //                       },
      //                       { $ne: ["$currentUser.bookmarks", []] },

      //                       {
      //                         $in: [
      //                           "$$ans._id",
      //                           {
      //                             $arrayElemAt: ["$currentUser.bookmarks", 0],
      //                           },
      //                         ],
      //                       },
      //                     ],
      //                   },

      //                   then: true,
      //                   else: false,
      //                 },
      //               },

      //               isOwnContent: {
      //                 $cond: {
      //                   if: {
      //                     $eq: [
      //                       { $arrayElemAt: ["$$ans.createdBy._id", 0] },
      //                       userId,
      //                     ],
      //                   },

      //                   then: true,
      //                   else: false,
      //                 },
      //               },

      //               isFollowing: {
      //                 $cond: {
      //                   if: {
      //                     $and: [
      //                       {
      //                         $ne: [
      //                           { $arrayElemAt: ["$currentUser.following", 0] },
      //                           [],
      //                         ],
      //                       },
      //                       {
      //                         $in: [
      //                           { $arrayElemAt: ["$$ans.createdBy._id", 0] },
      //                           {
      //                             $arrayElemAt: ["$currentUser.following", 0],
      //                           },
      //                         ],
      //                       },
      //                     ],
      //                   },

      //                   then: true,
      //                   else: false,
      //                 },
      //               },
      //               // totalFollowing: {
      //               //   $size: {
      //               //     $ifNull: [
      //               //       {
      //               //         $arrayElemAt: ["$currentUser.following", 0],
      //               //       },
      //               //       [],
      //               //     ],
      //               //   },
      //               // },
      //               totalFollowers: {
      //                 $size: {
      //                   $ifNull: [
      //                     {
      //                       $arrayElemAt: ["$$ans.createdBy.followers", 0],
      //                     },
      //                     [],
      //                   ],
      //                 },
      //               },
      //               // createdBy: {
      //               //   $mergeObjects: [
      //               //     { $arrayElemAt: ["$$ans.createdBy", 0] }, // Original fields
      //               //     {
      //               //       password: "$$REMOVE",
      //               //       isVerified: "$$REMOVE",
      //               //       __v: "$$REMOVE",
      //               //       settings: "$$REMOVE",
      //               //       passwordChangedAt: "$$REMOVE",
      //               //       forgotMaxTime: "$$REMOVE",
      //               //       createdAt: "$$REMOVE",
      //               //       updatedAt: "$$REMOVE",
      //               //       forgotFirstTime: "$$REMOVE",
      //               //       language: "$$REMOVE",
      //               //       additionalEmails: "$$REMOVE",
      //               //       refreshToken: "$$REMOVE",
      //               //       isLoginSecurity: "$$REMOVE",
      //               //       passwordResetExpires: "$$REMOVE",
      //               //       passwordResetToken: "$$REMOVE",
      //               //       passwordVerified: "$$REMOVE",
      //               //       passwordVerifiedExpires: "$$REMOVE",
      //               //       Preferences: "$$REMOVE",
      //               //     },
      //               //   ],
      //               // },
      //               createdBy: {
      //                 $let: {
      //                   vars: {
      //                     createdByObj: {
      //                       $arrayElemAt: ["$$ans.createdBy", 0],
      //                     }, // Get the `createdBy` object
      //                   },
      //                   in: {
      //                     // _id: "$$createdByObj._id",
      //                     // name: "$$createdByObj.name",
      //                     // email: "$$createdByObj.email",
      //                     // profilePicture: "$$createdByObj.ram",
      //                     // // Add only the fields you need here
      //                     $arrayToObject: {
      //                       $filter: {
      //                         input: { $objectToArray: "$$createdByObj" },
      //                         as: "field",
      //                         cond: {
      //                           $not: {
      //                             $in: [
      //                               "$$field.k",
      //                               [
      //                                 "password",
      //                                 "isVerified",
      //                                 "__v",
      //                                 "settings",
      //                                 "passwordChangedAt",
      //                                 "forgotMaxTime",
      //                                 "createdAt",
      //                                 "updatedAt",
      //                                 "forgotFirstTime",
      //                                 "language",
      //                                 "additionalEmails",
      //                                 "refreshToken",
      //                                 "isLoginSecurity",
      //                                 "passwordResetExpires",
      //                                 "passwordResetToken",
      //                                 "passwordVerified",
      //                                 "passwordVerifiedExpires",
      //                                 "preferences",
      //                               ],
      //                             ],
      //                           },
      //                         },
      //                       },
      //                     },
      //                   },
      //                 },
      //               },

      //               // ccU: { $arrayElemAt: ["$currentUser.following", 0] },

      //               // ansId: "$$ans.createdBy._id",
      //               // check: "$$ans._id",
      //               // check0: "$$ans.createdBy",

      //               // put bookmarked inside createdBy
      //               // createdBy: {
      //               //   $mergeObjects: [
      //               //     {
      //               //       $arrayElemAt: ["$$ans.createdBy", 0],
      //               //     },
      //               //     {
      //               //       isBookmarked: {
      //               //         $cond: {
      //               //           if: {
      //               //             $or: [
      //               //               { $eq: ["$$ans.createdBy.bookmarks", []] },
      //               //               {
      //               //                 $in: [
      //               //                   "$$ans._id",
      //               //                   {
      //               //                     $arrayElemAt: [
      //               //                       "$$ans.createdBy.bookmarks",
      //               //                       0,
      //               //                     ],
      //               //                   },
      //               //                 ],
      //               //               },
      //               //             ],
      //               //           },

      //               //           then: true,
      //               //           else: false,
      //               //         },
      //               //       },
      //               //     },
      //               //   ],
      //               // },
      //               // check: "$$ans._id",
      //               // check0: "$$ans.createdBy",
      //             },
      //           ],
      //         },
      //       },
      //     },
      //   },
      // },

      // end map
      {
        $project: {
          answers: 0,
          allAnswer: 0,
          downvotes: 0,
          __v: 0,
          currentUser: 0,
          isPublic: 0,
          comments: 0,
        },
      },
    ]);

    res.status(200).json({
      status: "success",
      questions,
    });
  }
);

exports.getQuestionsRequestFromQuoraController = CatchAsync(
  async (req, res, next) => {
    const userId = new ObjectId(req.userId);
    let { page, limit } = req.query;

    page = parseInt(page) || 1;
    limit = parseInt(limit) || 7;

    if (page < 1) {
      page = 1;
    }
    if (limit < 1) {
      limit = 7;
    }

    const skip = (page - 1) * limit;

    // Initialize seenQuestions array in session if not already present
    req.session.seenQuestions = req.session.seenQuestions || [];
    const questions = await Question.aggregate([
      // question but not created by current user
      {
        $match: {
          isPublic: true,
          createdBy: { $ne: userId },
          $expr: {
            $not: {
              $in: [userId, { $ifNull: ["$downvotes", []] }],
            },
          },
        },
      },
      {
        $sample: {
          size: 50,
        },
      },
      {
        $match: {
          // createdBy: new ObjectId(quoraId),
          _id: {
            $nin: req.session.seenQuestions?.map((id) => new ObjectId(id)),
          },
        },
      },
      { $skip: skip },
      { $limit: limit },
      // lookup on question createdBy
      {
        $lookup: {
          from: "users",
          localField: "createdBy",
          foreignField: "_id",
          pipeline: [
            {
              $project: {
                totalFollowers: { $size: { $ifNull: ["$followers", []] } },
                isFollowing: {
                  $in: [userId, { $ifNull: ["$followers", []] }],
                },
              },
            },
          ],
          as: "createdBy",
        },
      },
      // user without array
      {
        $addFields: {
          createdBy: { $arrayElemAt: ["$createdBy", 0] },
        },
      },
      // add fields
      {
        $addFields: {
          totalAnswers: { $size: { $ifNull: ["$answers", []] } },
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
      {
        $project: {
          __v: 0,
          answers: 0,
        },
      },
    ]);

    // Update the seenQuestions list in the session
    req.session.seenQuestions = [
      ...req.session.seenQuestions.filter(
        (id) => !questions.some((q) => q._id.equals(id))
      ),
      ...questions.map((q) => q._id),
    ];

    res.status(200).json({
      status: "success",
      questions,
    });
  }
);

exports.addQuestionController = CatchAsync(async (req, res, next) => {
  const { question, tags, isPublic } = req.body;
  if (!question) {
    return next(new AppError("Please provide question", 400));
  }
  const newQuestion = await Question.create({
    question,
    createdBy: req.userId,
    tags,
    isPublic,
  });

  console.log(newQuestion);
  res.status(200).json({
    status: "success",
    message: "Question added successfully",
  });
});

exports.handleDownvote = CatchAsync(async (req, res, next) => {
  const { questionId } = req.body;
  const userId = req.userId;

  if (!questionId) {
    return next(new AppError("Please provide questionId", 400));
  }

  const question = await Question.findById(questionId);

  if (!question) {
    return next(new AppError("question not found", 404));
  }
  if (userId === question?.createdBy?.toString()) {
    return next(new AppError("You cannot downvote your own question", 400));
  }

  const isAlreadyDownvoted = await Question.findOne({
    _id: questionId,
    downvotes: userId,
  });
  let message;
  if (isAlreadyDownvoted) {
    await Question.findByIdAndUpdate(questionId, {
      $pull: { downvotes: userId },
    });
    message = "Removed downvote";
  } else {
    await Question.findByIdAndUpdate(questionId, {
      $addToSet: { downvotes: userId },
    });
    message = "Downvoted successfully";
  }
  return res.status(200).json({
    status: "success",
    message,
  });
});
