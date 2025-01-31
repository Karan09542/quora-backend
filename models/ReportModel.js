const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema(
  {
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Please provide reporter UserId"],
    },
    reportedContent: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "Please provide PostId"],
    },
    contentType: {
      type: String,
      required: [true, "Please provide content-type"],
      enum: ["answer", "question", "comment", "user"],
    },
    reasonType: {
      type: String,
      enum: ["credential", "description", "photo", "name", "content"],
      required: function () {
        return this.contentType === "user"
          ? "user reason type is required"
          : false;
      },
    },
    reason: {
      type: String,
      required: [true, "Please provide reason of report"],
      enum: [
        "Spam",
        "Hate Speech",
        "Harassment and bullying",
        "Harmful activities",
        "Adult content (Consensual)",
        "Sexual exploitation and abuse (child safety)",
        "Sexually explicit or suggestive imagery or writing involving minors",
        "Plagiarism",
        "Poorly written",
        "Inappropriate credential",
        "Other",
      ],
    },
    additionalInfo: String,
    status: {
      type: String,
      default: "pending",
      enum: ["pending", "reviewed", "resolved", "rejected"],
    },
    reviewedAt: Date,
  },
  { timestamps: true }
);

const Report = mongoose.model("Report", reportSchema);
module.exports = Report;
