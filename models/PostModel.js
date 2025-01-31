const mongoose = require("mongoose");

const postSchema = new mongoose.Schema(
  {
    content: {
      type: String,
      required: [true, "Content is required"],
    },
    searchText: {
      type: String,
      required: [true, "Search text is required"],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Post creator is required"],
    },
    spaces: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Space",
    },
    upvotes: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },
    downvotes: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },
    images: {
      type: [String],
      default: [],
    },
    comments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Comment",
      },
    ],
    isPublished: {
      type: Boolean,
      default: false,
    },
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "question",
    },
    contentType: {
      type: String,
      enum: ["post", "answer"],
      default: "post",
      required: [true, "Type is required"],
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

postSchema.index({ searchText: "text" });

const Post = mongoose.model("Post", postSchema);

module.exports = Post;
