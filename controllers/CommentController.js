const AppError = require("../ErrorHandling/AppError");
const { CatchAsync } = require("../ErrorHandling/utils");
const Comment = require("../models/CommentModel");
const Post = require("../models/PostModel");
const ObjectId = require("mongoose").Types.ObjectId;

exports.addCommentController = CatchAsync(async (req, res, next) => {
  const { content, postId, parentPath } = req.body;
  const userId = req.userId;

  if (!content || !postId) {
    return next(new AppError("Content, postId is required", 400));
  }

  if (!ObjectId?.isValid(postId)) {
    return next(new AppError("Invalid postId", 400));
  }

  //   check is post exitst
  const post = await Post.findById(postId);
  if (!post) {
    return next(new AppError("Post not found", 404));
  }

  let newPath;
  if (!parentPath) {
    const lastRootComment = await Comment.findOne({
      postId,
      path: { $size: 1 },
    })
      .sort({ "path.0": -1 })
      .limit(1)
      .exec();
    const newRootPath = lastRootComment ? [lastRootComment.path[0] + 1] : [1];

    newPath = newRootPath;
  } else {
    if (!Array.isArray(parentPath)) {
      return next(
        new AppError(
          `Parent path must be an array but got ${typeof parentPath}`,
          400
        )
      );
    }

    if (parentPath.length > 1) {
      const parentComment = await Comment.findOne({
        path: parentPath.slice(0, parentPath.length - 1),
      });
      if (!parentComment) {
        return next(
          new AppError("Parent comment not found for this path", 404)
        );
      }
    }

    const requiredLength = parentPath.length + 1;
    const lastChildComment = await Comment.findOne({
      postId,
      $expr: {
        $and: [
          {
            $eq: [{ $slice: ["$path", parentPath.length] }, parentPath], // Match first part of the path with parentPath
          },
          {
            $eq: [{ $size: "$path" }, requiredLength], // Ensure path length is parentPath.length + 1
          },
        ],
      },
    })
      .sort({ [`path.${parentPath.length}`]: -1 })
      .limit(1)
      .exec();

    const lastIndex = lastChildComment?.path[parentPath.length];
    const nextIndex = lastIndex ? lastIndex + 1 : 1;

    newPath = [...parentPath, nextIndex];
  }

  const comment = await Comment.create({
    content,
    createdBy: userId,
    postId,
    path: newPath,
  });
  res.status(201).json({
    status: "success",
    message: "Comment added successfully",
    commentMainData: {
      _id: comment._id,
      path: comment.path,
      createdAt: comment.createdAt,
    },
  });
});

exports.getCommentsController = CatchAsync(async (req, res, next) => {
  let { postId, userId } = req.params;
  let { page, limit } = req.query;

  page = parseInt(page) || 1;
  limit = parseInt(limit) || 2;
  if (page < 1) {
    page = 1;
  }
  if (limit < 1) {
    limit = 2;
  }

  if (page === 1) {
    limit = 2;
  }
  const skip = (page - 1) * 2;
  console.log({ page, limit, skip });

  userId = userId !== "undefined" ? new ObjectId(userId) : userId;
  if (!postId) {
    return next(new AppError("Please provide post id", 400));
  }
  if (!userId) {
    return next(new AppError("Please provide user id", 400));
  }
  const rootComments = await Comment.aggregate([
    {
      $match: {
        postId: new ObjectId(postId),
        path: { $size: 1 },
      },
    },
    {
      $skip: skip,
    },
    {
      $limit: 2,
    },
    // sub comments
    {
      $lookup: {
        from: "comments",
        let: { parentPath: "$path" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$postId", new ObjectId(postId)] },
                  {
                    $eq: [
                      { $arrayElemAt: ["$path", 0] },
                      { $arrayElemAt: ["$$parentPath", 0] },
                    ],
                  },
                  { $eq: [{ $size: "$path" }, 2] }, // Ensure path length is at most 2
                ],
              },
            },
          },
          {
            $limit: 2,
          },
          //  same as parent
          {
            $lookup: {
              from: "users",
              localField: "createdBy",
              foreignField: "_id",
              as: "createdBy",
            },
          },
          {
            $unwind: "$createdBy",
          },
          {
            $addFields: {
              totalFollowers: {
                $size: { $ifNull: ["$createdBy.followers", []] },
              },
              isFollowing: {
                $in: [userId, "$createdBy.followers"],
              },
              isOwnProfile: {
                $eq: [userId, "$createdBy._id"],
              },
              isUpvoted: {
                $in: [userId, "$upvotes"],
              },
              isDownvoted: {
                $in: [userId, "$downvotes"],
              },
              totalUpvotes: {
                $size: "$upvotes",
              },
            },
          },
          // filter createdBy
          {
            $addFields: {
              createdBy: {
                $let: {
                  vars: {
                    createdByObj: "$createdBy",
                  },
                  in: {
                    $arrayToObject: {
                      $filter: {
                        input: { $objectToArray: "$$createdByObj" },
                        as: "field",
                        cond: {
                          $in: [
                            "$$field.k",
                            [
                              "_id",
                              "username",
                              "profilePicture",
                              "createdAt",
                              "credentials",
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
          // // get one more children
          {
            $lookup: {
              from: "comments",
              let: { parentPath: "$path" },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ["$postId", new ObjectId(postId)] },
                        {
                          $eq: [
                            { $slice: ["$path", 0, 2] },
                            { $slice: ["$$parentPath", 0, 2] },
                            // { $arrayElemAt: ["$path", 0] },
                            // { $arrayElemAt: ["$$parentPath", 0] },
                          ],
                        },
                        { $eq: [{ $size: "$path" }, 3] }, // Ensure path length is at most 3
                      ],
                    },
                  },
                },
                {
                  $limit: 2,
                },
                //  same as parent
                {
                  $lookup: {
                    from: "users",
                    localField: "createdBy",
                    foreignField: "_id",
                    as: "createdBy",
                  },
                },
                {
                  $unwind: "$createdBy",
                },
                {
                  $addFields: {
                    totalFollowers: {
                      $size: { $ifNull: ["$createdBy.followers", []] },
                    },
                    isFollowing: {
                      $in: [userId, "$createdBy.followers"],
                    },
                    isOwnProfile: {
                      $eq: [userId, "$createdBy._id"],
                    },
                    isUpvoted: {
                      $in: [userId, "$upvotes"],
                    },
                    isDownvoted: {
                      $in: [userId, "$downvotes"],
                    },
                    totalUpvotes: {
                      $size: "$upvotes",
                    },
                  },
                },
                // filter createdBy
                {
                  $addFields: {
                    createdBy: {
                      $let: {
                        vars: {
                          createdByObj: "$createdBy",
                        },
                        in: {
                          $arrayToObject: {
                            $filter: {
                              input: { $objectToArray: "$$createdByObj" },
                              as: "field",
                              cond: {
                                $in: [
                                  "$$field.k",
                                  [
                                    "_id",
                                    "username",
                                    "profilePicture",
                                    "createdAt",
                                    "credentials",
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
              as: "children",
            },
          },
          // // end one more children
        ],
        as: "children",
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
      $unwind: "$createdBy",
    },
    {
      $addFields: {
        totalFollowers: { $size: { $ifNull: ["$createdBy.followers", []] } },
        isFollowing: {
          $in: [userId, "$createdBy.followers"],
        },
        isOwnProfile: {
          $eq: [userId, "$createdBy._id"],
        },
        isUpvoted: {
          $in: [userId, "$upvotes"],
        },
        isDownvoted: {
          $in: [userId, "$downvotes"],
        },
        totalUpvotes: {
          $size: "$upvotes",
        },
      },
    },
    // filter createdBy
    {
      $addFields: {
        createdBy: {
          $let: {
            vars: {
              createdByObj: "$createdBy",
            },
            in: {
              $arrayToObject: {
                $filter: {
                  input: { $objectToArray: "$$createdByObj" },
                  as: "field",
                  cond: {
                    $in: [
                      "$$field.k",
                      [
                        "_id",
                        "username",
                        "profilePicture",
                        "createdAt",
                        "credentials",
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
  ]);

  res.status(200).json({
    status: "success",
    comments: rootComments,
    userId,
  });
});

exports.getCommentsFromCommentIdController = CatchAsync(
  async (req, res, next) => {
    const { commentId } = req.params;
    let userId = req.headers["x-userid"];
    userId = userId !== "undefined" ? new ObjectId(userId) : userId;

    const comment = await Comment.aggregate([
      {
        $match: {
          _id: new ObjectId(commentId),
        },
      },
      // sub comments
      {
        $lookup: {
          from: "comments",
          localField: "postId",
          foreignField: "postId",
          let: { parentPath: "$path" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    {
                      $eq: [
                        "$$parentPath",
                        { $slice: ["$path", 0, { $size: "$$parentPath" }] },
                      ],
                    },
                    {
                      $eq: [
                        { $size: "$path" },
                        { $add: [{ $size: "$$parentPath" }, 1] },
                      ],
                    }, // Ensure path length is at most 2
                  ],
                },
              },
            },
            {
              $limit: 2,
            },
            //  same as parent
            {
              $lookup: {
                from: "users",
                localField: "createdBy",
                foreignField: "_id",
                as: "createdBy",
              },
            },
            {
              $unwind: "$createdBy",
            },
            {
              $addFields: {
                totalFollowers: {
                  $size: { $ifNull: ["$createdBy.followers", []] },
                },
                isFollowing: {
                  $in: [userId, "$createdBy.followers"],
                },
                isOwnProfile: {
                  $eq: [userId, "$createdBy._id"],
                },
                isUpvoted: {
                  $in: [userId, "$upvotes"],
                },
                isDownvoted: {
                  $in: [userId, "$downvotes"],
                },
                totalUpvotes: {
                  $size: "$upvotes",
                },
              },
            },
            // // get one more children
            {
              $lookup: {
                from: "comments",
                localField: "postId",
                foreignField: "postId",
                let: { parentPath: "$path" },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          {
                            $eq: [
                              "$$parentPath",
                              {
                                $slice: ["$path", 0, { $size: "$$parentPath" }],
                              },
                            ],
                          },
                          {
                            $eq: [
                              { $size: "$path" },
                              { $add: [{ $size: "$$parentPath" }, 1] },
                            ],
                          }, // Ensure path length is at most 2
                        ],
                      },
                    },
                  },
                  {
                    $limit: 2,
                  },
                  //  same as parent
                  {
                    $lookup: {
                      from: "users",
                      localField: "createdBy",
                      foreignField: "_id",
                      as: "createdBy",
                    },
                  },
                  {
                    $unwind: "$createdBy",
                  },
                  {
                    $addFields: {
                      totalFollowers: {
                        $size: { $ifNull: ["$createdBy.followers", []] },
                      },
                      isFollowing: {
                        $in: [userId, "$createdBy.followers"],
                      },
                      isOwnProfile: {
                        $eq: [userId, "$createdBy._id"],
                      },
                      isUpvoted: {
                        $in: [userId, "$upvotes"],
                      },
                      isDownvoted: {
                        $in: [userId, "$downvotes"],
                      },
                      totalUpvotes: {
                        $size: "$upvotes",
                      },
                    },
                  },
                  // filter createdBy
                  {
                    $addFields: {
                      createdBy: {
                        $let: {
                          vars: {
                            createdByObj: "$createdBy",
                          },
                          in: {
                            $arrayToObject: {
                              $filter: {
                                input: { $objectToArray: "$$createdByObj" },
                                as: "field",
                                cond: {
                                  $in: [
                                    "$$field.k",
                                    [
                                      "_id",
                                      "username",
                                      "profilePicture",
                                      "createdAt",
                                      "credentials",
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
                  {
                    $project: {
                      upvotes: 0,
                      downvotes: 0,
                      __v: 0,
                      updatedAt: 0,
                    },
                  },
                ],
                as: "children",
              },
            },
            // // end one more children

            // filter createdBy
            {
              $addFields: {
                createdBy: {
                  $let: {
                    vars: {
                      createdByObj: "$createdBy",
                    },
                    in: {
                      $arrayToObject: {
                        $filter: {
                          input: { $objectToArray: "$$createdByObj" },
                          as: "field",
                          cond: {
                            $in: [
                              "$$field.k",
                              [
                                "_id",
                                "username",
                                "profilePicture",
                                "createdAt",
                                "credentials",
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
            { $project: { upvotes: 0, downvotes: 0, __v: 0, updatedAt: 0 } },
          ],
          as: "children",
        },
      },
      {
        $project: {
          children: 1,
          _id: 0,
        },
      },
    ]);
    res.status(200).json({
      status: "success",
      children: comment?.[0]?.children || [],
    });
  }
);

// updownvote comment
exports.handleUpvote = CatchAsync(async (req, res, next) => {
  const { commentId } = req.body;
  const userId = req.userId;

  const comment = await Comment.findById(commentId);
  if (!comment) {
    return next(new AppError("Comment not found", 404));
  }

  if (userId === comment?.createdBy?.toString()) {
    return next(new AppError("You cannot upvote your own comment", 400));
  }

  const isAlreadyUpvoted = await Comment.exists({
    _id: commentId,
    upvotes: userId,
  });
  let message;
  if (isAlreadyUpvoted) {
    await Comment.findByIdAndUpdate(commentId, {
      $pull: { upvotes: userId, downvotes: userId },
    });
    message = "Removed upvote";
  } else {
    await Comment.findByIdAndUpdate(commentId, {
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
  const { commentId } = req.body;
  const userId = req.userId;
  const comment = await Comment.findById(commentId);
  if (!comment) {
    return next(new AppError("Comment not found", 404));
  }

  if (userId === comment?.createdBy?.toString()) {
    return next(new AppError("You cannot downvote your own comment", 400));
  }

  const isAlreadyDownvoted = await Comment.findOne({
    _id: commentId,
    downvotes: userId,
  });

  let message;

  if (isAlreadyDownvoted) {
    await Comment.findByIdAndUpdate(commentId, {
      $pull: { upvotes: userId, downvotes: userId },
    });
    message = "Removed downvote";
  } else {
    await Comment.findByIdAndUpdate(commentId, {
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
