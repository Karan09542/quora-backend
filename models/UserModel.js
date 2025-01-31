const mongoose = require("mongoose");
const { Schema } = require("mongoose");
const emailValidator = require("email-validator");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

const languageEnum = [
  "english",
  "hindi",
  "sanskrit",
  "punjabi",
  "marathi",
  "gujarati",
  "bengali",
  "tamil",
  "telugu",
  "kannada",
  "malayalam",
  "kashmiri",
  "urdu",
  "espanol",
  "portuguese",
  "italian",
  "french",
  "spanish",
  "german",
  "japanese",
  "chinese",
  "korean",
  "arabic",
  "indonesian",
  "vietnamese",
  "netherlands",
  "bhojpuri",
  "nepali",
];

const worldLanguages = [
  // Indian Languages
  "Assamese",
  "Bengali",
  "Bodo",
  "Dogri",
  "Gujarati",
  "Hindi",
  "Kannada",
  "Kashmiri",
  "Konkani",
  "Maithili",
  "Malayalam",
  "Manipuri",
  "Marathi",
  "Nepali",
  "Odia",
  "Punjabi",
  "Sanskrit",
  "Santali",
  "Sindhi",
  "Tamil",
  "Telugu",
  "Urdu",
  "Tulu",
  "Bhojpuri",
  "Rajasthani",
  "Garhwali",
  "Kumaoni",
  "Haryanvi",
  "Chhattisgarhi",
  "Mizo",
  "Khasi",
  "Garo",
  "Lepcha",
  "Kokborok",

  // Languages from Other Countries
  "English",
  "Spanish",
  "Mandarin Chinese",
  "French",
  "German",
  "Italian",
  "Russian",
  "Portuguese",
  "Arabic",
  "Japanese",
  "Korean",
  "Turkish",
  "Thai",
  "Vietnamese",
  "Persian",
  "Hebrew",
  "Greek",
  "Dutch",
  "Swedish",
  "Norwegian",
  "Danish",
  "Finnish",
  "Czech",
  "Polish",
  "Hungarian",
  "Romanian",
  "Ukrainian",
  "Malay",
  "Indonesian",
  "Filipino",
  "Swahili",
  "Zulu",
  "Xhosa",
  "Afrikaans",
  "Amharic",
  "Hausa",
  "Igbo",
  "Yoruba",
  "Pashto",
  "Urdu (Pakistan)",
  "Burmese",
  "Lao",
  "Khmer",
  "Sinhala",
  "Tibetan",
  "Mongolian",
  "Georgian",
  "Armenian",
  "Uzbek",
  "Kazakh",
];

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
    },
    maxUsernameUpdated: {
      type: Number,
      min: 0,
      max: 10,
      default: 0,
    },
    email: {
      type: String,
      unique: true,
      required: [true, "Email is required"],
      validate: {
        validator: (email) => {
          return emailValidator.validate(email);
        },
        message: "Please provide a valid email",
      },
    },
    password: {
      type: String,
      required: ["true", "Password is required!"],
      select: false,
      validate: {
        validator: function (password) {
          return password.length > 7;
        },
        message: "Password must be at least 8 characters",
      },
    },
    active: {
      type: Boolean,
      default: true,
    },
    confirmPassword: {
      type: String,
      select: false,
      required: [true, "Confirm password is required"],
      validate: {
        validator: function (confirmPassword) {
          return this.password === confirmPassword;
        },
        message: "Provided password does not match",
      },
    },
    profilePicture: {
      type: String, // URL for profile picture
    },
    bio: {
      type: String,
      maxlength: 300,
    },
    dob: {
      type: Date,
      required: [true, "Please provide your date of birth"],
      validate: {
        validator: (dob) => {
          return dob < Date.now();
        },
        message: "Please provide a valid date of birth",
      },
    },
    followers: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    following: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    posts: [
      {
        type: Schema.Types.ObjectId,
        ref: "Post",
      },
    ],
    likes: [
      {
        type: Schema.Types.ObjectId,
        ref: "Post",
      },
    ],
    savedPosts: [
      {
        type: Schema.Types.ObjectId,
        ref: "Post",
      },
    ],
    refreshToken: {
      type: [String],
      default: [],
      select: false,
    },

    isVerified: {
      type: Boolean,
      default: false,
    },
    preferences: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Preference",
    },
    //
    notifications: [
      {
        message: String,
        isRead: {
          type: Boolean,
          default: false,
        },
        createdAt: {
          type: Date,
          default: Date.now(),
        },
      },
    ],
    // notifications: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: "Notification",
    // },
    settings: {
      privacy: {
        isIndexable: {
          type: Boolean,
          default: true,
        },
        isAdultContent: {
          type: Boolean,
          default: false,
        },
        isEmailDiscoverable: {
          type: Boolean,
          default: true,
        },
        isLLM: {
          type: Boolean,
          default: true,
        },
        whoSendMessage: {
          type: String,
          enum: ["everyone", "followed", "none"],
          default: "followed",
        },
        isAllowedToComment: {
          type: Boolean,
          default: true,
        },
        isGifAutoPlay: {
          type: Boolean,
          default: true,
        },
        isAllowedToPromoteAnswers: {
          type: Boolean,
          default: true,
        },
        isNotifySubscribersOfNewQuestions: {
          type: Boolean,
          default: true,
        },
      },
      theme: {
        type: String,
        enum: ["light", "dark", "auto"],
        default: "auto",
      },
      fontSize: {
        type: String,
        enum: ["small", "medium", "large", "larger"],
        default: "medium",
      },
    },

    // Email verification
    otp: Number,
    verificationToken: {
      type: String,
    },
    verificationTokenExpires: {
      type: Date,
    },

    // password reset

    passwordChangedAt: {
      type: Date,
      default: Date.now(),
      select: false,
    },
    passwordResetToken: {
      type: String,
    },
    passwordResetExpires: Date,

    // forget password
    forgotMaxTime: {
      type: Number,
      default: 0,
      max: 3,
      min: 0,
    },
    forgotAtTommorrow: {
      type: Date,
    },
    forgotFirstTime: Date,

    bookmarks: {
      type: [Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },
    credentials: {
      employment: {
        position: String,
        company: String,
        startYear: Number,
        endYear: Number,
        isCurrent: Boolean,
      },
      education: {
        school: String,
        primaryMajor: String,
        secondaryMajor: String,
        degree: String,
        graduationYear: Number,
      },
      location: {
        address: String,
        startYear: Number,
        endYear: Number,
        isCurrent: Boolean,
      },
      profile: String,
      description: String,
    },
    language: {
      primary: {
        type: String,
        default: "english",
        enum: languageEnum,
      },
      additional: {
        type: [String],
        default: ["english"],
        enum: languageEnum,
      },
    },
    // spaces: [
    //   {
    //     type: Schema.Types.ObjectId,
    //     ref: "Space",
    //   },
    // ],
    additionalEmails: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "email",
      },
    ],
    isLoginSecurity: {
      type: Boolean,
      default: false,
    },

    passwordVerified: {
      type: Boolean,
      default: false,
    },
    passwordVerifiedExpires: {
      type: Date,
      default: null,
    },
  },

  // { timestamps: true } in Mongoose automatically adds createdAt and updatedAt fields to each document.
  { timestamps: true }
);

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
  this.confirmPassword = undefined;
});

userSchema.methods.createVerificationToken = function () {
  const verificationToken = crypto.randomBytes(32).toString("hex");
  const otp = Math.floor(100000 + Math.random() * 900000);
  this.verificationToken = crypto
    .createHash("sha256")
    .update(verificationToken)
    .digest("hex");
  this.verificationTokenExpires = Date.now() + 10 * 60 * 1000;
  this.otp = otp;

  return [verificationToken, otp];
};

userSchema.methods.isCorrectPassword = function (rawPassword) {
  return bcrypt.compare(rawPassword, this.password);
};

userSchema.methods.createPasswordResetToken = async function () {
  const resetToken = crypto.randomBytes(32).toString("hex");
  this.passwordResetToken = await crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;
  return resetToken;
};

userSchema.methods.changedPasswordAfter = async function (jwtIssuedAt) {
  if (!this.passwordChangedAt) {
    return false;
  }
  const changedTimestamp = parseInt(
    this.passwordChangedAt.getTime() / 1000,
    10
  );
  return jwtIssuedAt < changedTimestamp;
};

userSchema.methods.validateEducationCredential = function (
  educationCredential
) {
  if (
    !educationCredential.school &&
    !(educationCredential.primaryMajor && educationCredential.secondaryMajor)
  ) {
    return false;
  }

  const filteredEducation = Object.keys(educationCredential).reduce(
    (acc, key) => {
      if (educationCredential[key]) {
        acc[key] = educationCredential[key];
      }
      return acc;
    },
    {}
  );
  return filteredEducation;
};

userSchema.methods.validateEmploymentCredential = function (
  employmentCredential
) {
  if (!employmentCredential.position && !employmentCredential.company) {
    return false;
  }
  const filteredEmployment = Object.keys(employmentCredential).reduce(
    (acc, key) => {
      if (employmentCredential[key]) {
        acc[key] = employmentCredential[key];
      }
      return acc;
    },
    {}
  );
  return filteredEmployment;
};

userSchema.methods.validateLocationCredential = function (locationCredential) {
  if (!locationCredential.address) {
    return false;
  }
  const filteredLocation = Object.keys(locationCredential).reduce(
    (acc, key) => {
      if (locationCredential[key]) {
        acc[key] = locationCredential[key];
      }
      return acc;
    },
    {}
  );
  return filteredLocation;
};

const User = mongoose.model("user", userSchema);

module.exports = User;
