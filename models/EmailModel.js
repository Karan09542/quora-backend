const mongoose = require("mongoose");
const emailValidator = require("email-validator");
const crypto = require("crypto");

const emailSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      unique: true,
      required: [true, "Email is required"],
      validate: {
        validator: (email) => emailValidator.validate(email),
        message: "Please provide a valid email",
      },
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"],
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationToken: String,
    verificationTokenExpires: Date,
  },
  { timestamps: true }
);

emailSchema.methods.createVerificationToken = async function () {
  const verificationToken = crypto.randomBytes(32).toString("hex");
  this.verificationToken = await crypto
    .createHash("sha256")
    .update(verificationToken)
    .digest("hex");
  this.verificationTokenExpires = Date.now() + 10 * 60 * 1000;
  return verificationToken;
};

const Email = mongoose.model("email", emailSchema);

module.exports = Email;
