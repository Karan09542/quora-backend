const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      unique: true,
      required: [true, "Question is required"],
      maxlength: [150, "Question cannot be more than 150 characters"],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: [true, "Question creator is required"],
    },
    tags: {
      type: [String],
      default: [],
    },
    views: {
      type: Number,
      default: 0,
    },
    answers: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "Post",
    },
    status: {
      type: String,
      enum: ["open", "closed"],
      default: "open",
    },
    isPublic: {
      type: Boolean,
      default: true,
    },
    downvotes: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

questionSchema.index({
  question: "text",
});

const Question = mongoose.model("question", questionSchema);

module.exports = Question;
