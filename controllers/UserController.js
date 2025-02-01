const { ObjectId } = require("mongoose").Types;
const { CatchAsync } = require("../ErrorHandling/utils");
const User = require("../models/UserModel");
const jwt = require("jsonwebtoken");
const AppError = require("../ErrorHandling/AppError");
const { hasMXRecord } = require("../utility/MxRecord");
const crypto = require("crypto");
const { sendEmailToVerifyEmail } = require("../utility/sendEmailToVerifyEmail");
const util = require("util");
const { sendEmail } = require("../utility/sendEmail");
const htmlTemplate = require("../utility/htmlTemplate.json");
const { console } = require("inspector");
const Email = require("../models/EmailModel");
const Question = require("../models/QuestionModel");
const Post = require("../models/PostModel");
const Report = require("../models/ReportModel");
const Preference = require("../models/PreferencesModel");
const { getAnswers, getQuestions } = require("../utility/getDocuments");

async function signAccessToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: "15m",
  });
}
async function signRefreshToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: "90d",
  });
}

function setCookies(res, token) {
  res.cookie("refreshToken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "none",
    expires: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
  });
}

exports.authorize = CatchAsync(async function (req, res, next) {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return next(new AppError("NOT_LOGGED_IN", 401));
  }

  let decoded;
  try {
    decoded = await util.promisify(jwt.verify)(
      token,
      process.env.JWT_ACCESS_SECRET
    );
  } catch (err) {
    return next(new AppError("NOT_LOGGED_IN", 401));
  }

  const currentUser = await User.findById(decoded.id).select(
    "+passwordChangedAt"
  );

  if (!currentUser) {
    return next(new AppError("NOT_LOGGED_IN", 401));
  }

  if (await currentUser.changedPasswordAfter(decoded.iat)) {
    // res.clearCookie("refreshToken");
    return next(
      new AppError("Password has been changed. Please login again!", 401)
    );
  }
  req.userId = decoded.id;
  next();
});

exports.userSignupController = CatchAsync(async (req, res, next) => {
  const { username, email, password, dob, confirmPassword } = req.body;
  if (!username || !email || !password || !dob || !confirmPassword) {
    next(new AppError("Please provide required fields", 400));
    return;
  }

  if (username.includes("-")) {
    next(new AppError("Please provide a valid Username!", 400));
  }

  await hasMXRecord(email)
    .then((has) => {
      if (!has) next(new AppError("Please provide a valid Email Id!", 400));
      return;
    })
    .catch((err) => {
      next(new AppError("Please provide a valid Email Id!", 400));
      return;
    });

  const user = await User.findOne({ email });

  if (user) {
    if (!user.isVerified) {
      sendEmailToVerifyEmail(res, user);
      return;
    } else {
      return next(new AppError("Please check your email", 400));
    }
  }

  if (password !== confirmPassword) {
    next(new AppError("Password does not match", 400));
    return;
  }
  const checkedUsername = await getUsernameForUpdate(username);
  const newUser = await User.create({
    username: checkedUsername,
    email,
    password,
    confirmPassword,
    dob,
  });

  sendEmailToVerifyEmail(res, newUser);
  return;
});

exports.userSignupVarificationController = CatchAsync(
  async (req, res, next) => {
    const { otp, verificationToken } = req.body;
    if (!otp || !verificationToken) {
      next(new AppError("Please provide otp and verification token", 400));
      return;
    }

    const decodedToken = crypto
      .createHash("sha256")
      .update(verificationToken)
      .digest("hex");
    const user = await User.findOne({ verificationToken: decodedToken }).select(
      "+refreshToken"
    );
    if (!user) {
      return res.status(400).json({
        status: "fail",
        message: "Please check your verificationtoken",
      });
    }

    if (user.verificationTokenExpires < Date.now()) {
      return next(
        new AppError("Token has been expired Please generate a new one!", 400)
      );
    }

    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    user.otp = undefined;
    user.isVerified = true;

    const accessToken = await signAccessToken(user._id);
    const refreshToken = await signRefreshToken(user._id);

    const hashRefreshToken = await crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");

    user.refreshToken.push(hashRefreshToken);

    const preferenceId = await Preference.create({ userId: user._id });
    user.preferences = preferenceId._id;
    await user.save({ validateBeforeSave: false });

    setCookies(res, refreshToken);

    res.status(200).json({
      status: "success",
      message: "Email verified successfully",
      accessToken,
    });
  }
);

exports.userLoginController = CatchAsync(async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return next(new AppError("Please provide email and password!", 400));
  }

  const user = await User.findOne({ email: email?.toLowerCase() }).select(
    "+password +refreshToken"
  );
  if (!user || !(await user.isCorrectPassword(password))) {
    return next(new AppError("Invalid email and password!", 401));
  }

  if (!user.isVerified) {
    return next(new AppError("Please verify your email", 401));
  }

  const accessToken = await signAccessToken(user._id);
  const refreshToken = await signRefreshToken(user._id);

  const hashRefreshToken = await crypto
    .createHash("sha256")
    .update(refreshToken)
    .digest("hex");
  user.refreshToken.push(hashRefreshToken);

  // preference
  const preference = await Preference.findOne({ userId: user._id });
  if (!preference) {
    await Preference.create({ userId: user._id });
  }
  // end preference
  await user.save({ validateBeforeSave: false });

  setCookies(res, refreshToken);
  res.status(200).json({
    status: "success",
    message: "Logged in successfully",
    accessToken,
  });
});

exports.userLogoutController = CatchAsync(async (req, res, next) => {
  const { refreshToken } = req.cookies;

  if (!refreshToken) {
    return next(new AppError("Please provide refresh token", 400));
  }

  const decodedToken = await util.promisify(jwt.verify)(
    refreshToken,
    process.env.JWT_REFRESH_SECRET
  );
  const hashRefreshToken = await crypto
    .createHash("sha256")
    .update(refreshToken)
    .digest("hex");
  const user = await User.findOne({
    $and: [{ _id: decodedToken.id }, { refreshToken: hashRefreshToken }],
  }).select("+refreshToken");

  if (!user) {
    return next(new AppError("User not found", 404));
  }

  user.refreshToken = user.refreshToken.filter(
    (token) => token !== hashRefreshToken
  );

  await user.save({ validateBeforeSave: false });

  res.clearCookie("refreshToken");
  res.status(200).json({
    status: "success",
    message: `Logged out successfully`,
  });
});

exports.logoutOfAllOtherDevicesController = CatchAsync(
  async (req, res, next) => {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      return next(new AppError("Please provide refresh token", 400));
    }

    const decodedToken = await util.promisify(jwt.verify)(
      refreshToken,
      process.env.JWT_REFRESH_SECRET
    );

    const hashRefreshToken = await crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");

    const user = await User.findById(decodedToken?.id).select("+refreshToken");
    if (!user) {
      return next(new AppError("User not found", 404));
    }

    user.refreshToken = [hashRefreshToken];
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      status: "success",
      message: "Logged out from all other devices successfully",
    });
  }
);

exports.GetCurrentUserController = CatchAsync(async function (req, res, next) {
  const userId = new ObjectId(req.userId);
  const user = await User.aggregate([
    { $match: { _id: userId } },
    { $limit: 1 },
    {
      $addFields: {
        totalBookmarks: {
          $size: { $ifNull: ["$bookmarks", []] },
        },
        totalFollowers: {
          $size: { $ifNull: ["$followers", []] },
        },
        totalFollowing: {
          $size: { $ifNull: ["$following", []] },
        },
      },
    },
    {
      $lookup: {
        from: "emails",
        let: { additionalEmails: "$additionalEmails" },
        pipeline: [
          {
            $match: {
              $expr: {
                $in: ["$_id", "$$additionalEmails"],
              },
            },
          },
        ],
        as: "additionalEmails",
      },
    },
    {
      $project: {
        _id: 1,
        active: 1,
        username: 1,
        email: 1,
        profilePicture: 1,
        createdAt: 1,
        updatedAt: 1,
        totalBookmarks: 1,
        totalFollowers: 1,
        totalFollowing: 1,
        dob: 1,
        //
        privacy: 1,
        additionalEmails: 1,
        settings: 1,
        language: 1,
        credentials: 1,
      },
    },
  ]);

  if (!user) {
    return next(new AppError("User not found", 404));
  }
  res.status(201).json({
    status: "success",
    user: user[0],
  });
});

exports.refreshTokenController = CatchAsync(async (req, res, next) => {
  console.log("incommingRefreshToken", req.body);
  const incommingRefreshToken = req.cookies.refreshToken;
  if (!incommingRefreshToken) {
    return next(new AppError("unauthorized request", 401));
  }

  let decoded;
  try {
    decoded = await util.promisify(jwt.verify)(
      incommingRefreshToken,
      process.env.JWT_REFRESH_SECRET
    );
  } catch (err) {
    return next(new AppError("Invalid or expired token", 401));
  }

  const user = await User.findById(decoded.id).select("+refreshToken");
  if (!user) {
    return next(new AppError("Invalid refresh token", 401));
  }

  const hashRefreshToken = await crypto
    .createHash("sha256")
    .update(incommingRefreshToken)
    .digest("hex");

  if (!user.refreshToken.includes(hashRefreshToken)) {
    return next(new AppError("Invalid refresh token", 401));
  }

  if (await user.changedPasswordAfter(decoded.iat)) {
    res.clearCookie("refreshToken");
    return next(
      new AppError("User recently changed password! Please login again", 401)
    );
  }

  const newAccessToken = await signAccessToken(user._id);

  res.status(200).json({
    status: "success",
    accessToken: newAccessToken,
  });
});

exports.userForgetPasswordController = CatchAsync(async (req, res, next) => {
  const { email } = req.body;
  if (!email) {
    return next(new AppError("Please provide your email", 400));
  }
  const user = await User.findOne({ email: email?.toLowerCase() });
  if (!user) {
    return next(new AppError("Please check your email", 404));
  }

  if (user.forgotMaxTime < 3) {
    if (user.forgotFirstTime && user.forgotFirstTime <= Date.now()) {
      user.forgotMaxTime = 1;
      user.forgotFirstTime = Date.now() + 24 * 60 * 60 * 1000;
      user.forgotAtTommorrow = undefined;
    } else {
      user.forgotMaxTime += 1;
      if (!user.forgotFirstTime && user.forgotMaxTime === 1) {
        user.forgotFirstTime = Date.now() + 24 * 60 * 60 * 1000;
      }
    }
  } else {
    if (!user.forgotAtTommorrow) {
      user.forgotAtTommorrow = Date.now() + 24 * 60 * 60 * 1000;
      await user.save({ validateBeforeSave: false });
      return next(new AppError("Please try after 24 hours ", 400));
    } else {
      if (user.forgotAtTommorrow >= Date.now()) {
        return next(new AppError("Please try after 24 hours ", 400));
      } else {
        user.forgotAtTommorrow = undefined;
        user.forgotMaxTime = 1;
        user.forgotFirstTime = Date.now() + 24 * 60 * 60 * 1000;
      }
    }
  }

  const resetToken = await user.createPasswordResetToken();

  await user.save({ validateBeforeSave: false }); // this is required if you use "=" to update values

  const emailOptions = {
    email: user.email,
    username: user.username,
    subject: "Reset Password",
    message:
      "You requested to reset your password. Click the link below to proceed:",
    path: "reset-password",
    token: resetToken,
    html: htmlTemplate["resetPassword"],
  };
  await sendEmail(emailOptions);

  res.status(200).json({
    status: "success",
    message:
      "Please check your inbox, we have sent an email for reset password!",
  });
});

exports.userUpdatePasswordController = CatchAsync(async (req, res, next) => {
  const { password, confirmPassword, token } = req.body;
  if (!password || !confirmPassword || !token) {
    return next(new AppError("Please provide required fields", 400));
  }

  if (password !== confirmPassword) {
    return next(new AppError("Password does not match", 400));
  }

  const hashedToken = await crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  }).select("+refreshToken");
  if (!user) {
    return next(
      new AppError(`Invalid or expired token ${hashedToken} and ${token}`, 400)
    );
  }

  user.password = password;
  user.passwordChangedAt = Date.now();
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;

  const accessToken = await signAccessToken(user._id);
  const refreshToken = await signRefreshToken(user._id);

  const hashRefreshToken = await crypto
    .createHash("sha256")
    .update(refreshToken)
    .digest("hex");

  user.refreshToken = [hashRefreshToken];
  await user.save({ validateBeforeSave: false });

  setCookies(res, refreshToken);

  res.status(200).json({
    status: "success",
    message: "Password updated successfully",
    accessToken,
  });
});

exports.fetchTitleController = CatchAsync(async (req, res, next) => {
  const { url } = req.body;
  if (!url) {
    return next(new AppError("Please provide url", 400));
  }

  const response = await fetch(url);

  if (!response.ok) {
    return next(new AppError("Please provide a valid url", 400));
  }

  const html = await response.text();
  const title = html.match(/<title>(.*?)<\/title>/)?.[1];

  res.status(200).json({
    status: "success",
    title: title,
    html,
  });
});

exports.userFollowingController = CatchAsync(async (req, res, next) => {
  const { followingTo } = req.body;
  const userId = req.userId;
  if (!followingTo) {
    return next(new AppError("Please provide following", 400));
  }

  if (userId === followingTo) {
    return next(new AppError("You cannot follow yourself", 400));
  }
  console.log({ followingTo });
  const isFollowing = await User.findOne({
    _id: userId,
    following: followingTo,
  });

  if (isFollowing) {
    await User.findByIdAndUpdate(userId, { $pull: { following: followingTo } });
    await User.findByIdAndUpdate(followingTo, { $pull: { followers: userId } });
    return res.status(200).json({
      status: "success",
      message: "User unfollowed successfully",
    });
  }
  await User.findByIdAndUpdate(userId, {
    $addToSet: { following: followingTo },
  });
  await User.findByIdAndUpdate(followingTo, {
    $addToSet: { followers: userId },
  });
  return res.status(200).json({
    status: "success",
    message: "User followed successfully",
  });
});

exports.handleBookmarksController = CatchAsync(async (req, res, next) => {
  const { postId } = req.body;
  const userId = req.userId;

  if (!postId) {
    return next(new AppError("Please provide post id", 400));
  }

  const userWithBookmark = await User.findOne({
    _id: userId,
    bookmarks: postId,
  });
  let message;
  if (!userWithBookmark) {
    await User.findByIdAndUpdate(userId, { $addToSet: { bookmarks: postId } });
    message = "Answer added from your bookmarks.";
  } else {
    await User.findByIdAndUpdate(userId, { $pull: { bookmarks: postId } });
    message = "Answer removed from your bookmarks.";
  }
  res.status(200).json({
    status: "success",
    message,
  });
});

exports.handlePrimaryLanguageController = CatchAsync(async (req, res, next) => {
  const { language } = req.body;
  const userId = req.userId;
  if (!language) {
    return next(new AppError("Please provide language", 400));
  }
  const user = await User.findById(userId);
  if (!user) {
    return next(new AppError("User not found", 404));
  }
  const hasLanguage = user.language.additional.includes(language.toLowerCase());
  if (!hasLanguage) {
    return next(new AppError("This credential does not exist.", 400));
  }
  await User.findByIdAndUpdate(userId, {
    "language.primary": language.toLowerCase(),
  });
  res.status(200).json({
    status: "success",
    message: `Your primary language is now set to ${
      language.charAt(0).toUpperCase() + language.slice(1)
    }`,
  });
});

exports.addLanguageController = CatchAsync(async (req, res, next) => {
  const { language } = req.body;
  const userId = req.userId;

  if (!language) {
    return next(new AppError("Please provide language", 400));
  }
  const user = await User.findById(userId);
  if (!user) {
    return next(new AppError("User not found", 404));
  }
  const hasLanguage = user.language.additional.includes(language.toLowerCase());
  if (hasLanguage) {
    return next(new AppError("This credential already exists.", 400));
  }
  await User.findByIdAndUpdate(userId, {
    $addToSet: { "language.additional": language.toLowerCase() },
  });
  res.status(200).json({
    status: "success",
    message: "successfully added a creadential",
  });
});
exports.removeLanguageController = CatchAsync(async (req, res, next) => {
  const { language } = req.body;
  const userId = req.userId;

  if (!language) {
    return next(new AppError("Please provide language", 400));
  }
  const user = await User.findById(userId);
  if (!user) {
    return next(new AppError("User not found", 404));
  }
  const hasLanguage = user.language.additional.includes(language.toLowerCase());
  if (!hasLanguage) {
    return next(new AppError("This credential does not exist.", 400));
  }
  await User.findByIdAndUpdate(userId, {
    $pull: { "language.additional": language.toLowerCase() },
  });
  res.status(200).json({
    status: "success",
    message: "successfully removed a creadential",
  });
});

exports.checkPasssword_And_Send_Confirmation_Email_Controller = CatchAsync(
  async (req, res, next) => {
    const { password, newEmail } = req.body;
    const userId = req.userId;

    if (!password && !newEmail) {
      return next(new AppError("Please provide email and password", 400));
    }
    const user = await User.findById(userId).select("+password");
    if (!user) {
      return next(new AppError("User not found", 404));
    }

    if (!(await user.isCorrectPassword(password))) {
      return next(
        new AppError(
          "The password you entered was incorrect, please try again.",
          400
        )
      );
    }

    if (user.email === newEmail) {
      return next(new AppError("Please provide a different email", 400));
    }

    await hasMXRecord(newEmail)
      .then((has) => {
        if (!has) next(new AppError("Please provide a valid Email Id!", 400));
        return;
      })
      .catch((err) => {
        next(new AppError("Please provide a valid Email Id!", 400));
        return;
      });

    const hasEmailInUserCollection = await User.findOne({ email: newEmail });
    if (hasEmailInUserCollection) {
      return next(new AppError("Email already exists", 400));
    }

    const hasEmail = await Email.findOne({ email: newEmail });
    if (hasEmail) {
      return next(new AppError("Email already exists", 400));
    }

    const createNewEmail = await Email.create({
      email: newEmail,
      userId,
    });

    await User.findByIdAndUpdate(userId, {
      $addToSet: { additionalEmails: createNewEmail._id },
    });

    const verificationToken = await createNewEmail.createVerificationToken();

    await createNewEmail.save({ validateBeforeSave: false });

    const options = {
      email: newEmail,
      username: user.username,
      path: "confirm-additional-email",
      token: verificationToken,
      html: htmlTemplate["addNewEmail"],
      subject: "Confirm your additional email address",
    };

    await sendEmail(options);

    res.status(200).json({
      status: "success",
      message: `Sent confirmation email to ${newEmail}`,
      emailId: createNewEmail._id,
      token: verificationToken,
    });
  }
);
exports.removeAdditionalEmailController = CatchAsync(async (req, res, next) => {
  const { emailId } = req.body;
  const userId = req.userId;

  if (!emailId) {
    return next(new AppError("Please provide emailId", 400));
  }

  const user = await User.findById(userId);

  if (!user) {
    return next(new AppError("User not found", 404));
  }

  const hasEmail = user.additionalEmails.includes(emailId);

  if (!hasEmail) {
    return next(new AppError("This email does not exist.", 400));
  }

  await User.findByIdAndUpdate(userId, {
    $pull: { additionalEmails: emailId },
  });
  const removedEmail = await Email.findByIdAndDelete(emailId);

  res.status(200).json({
    status: "success",
    message: `successfully removed ${removedEmail?.email}. This email is no longer linked to your Quora account.`,
  });
});

exports.confirmAdditionalEmailController = CatchAsync(
  async (req, res, next) => {
    const { emailId } = req.body;
    const userId = req.userId;

    if (!emailId) {
      return next(new AppError("Please provide emailId", 400));
    }

    const user = await User.findById(userId);

    if (!user) {
      return next(new AppError("User not found", 404));
    }

    const hasEmail = await Email.findById(emailId);

    if (!hasEmail) {
      return next(new AppError("Email not found", 404));
    }

    if (hasEmail?.userId?.toString() !== userId) {
      return next(
        new AppError("You are not authorized to perform this action", 401)
      );
    }

    if (hasEmail.isVerified) {
      return next(new AppError("Email already verified", 400));
    }

    const verificationToken = await hasEmail.createVerificationToken();

    await hasEmail.save({ validateBeforeSave: false });

    const options = {
      email: hasEmail?.email,
      username: user.username,
      path: "confirm-additional-email",
      token: verificationToken,
      html: htmlTemplate["addNewEmail"],
      subject: "Confirm your additional email address",
    };

    await sendEmail(options);

    res.status(200).json({
      status: "success",
      message: `Sent confirmation email to ${hasEmail?.email}`,
      token: verificationToken,
    });
  }
);
exports.verifyAdditionalEmailController = CatchAsync(async (req, res, next) => {
  const { verificationToken } = req.body;
  const userId = req.userId;

  if (!verificationToken) {
    return next(new AppError("Please provide verification token", 400));
  }

  const decodedToken = crypto
    .createHash("sha256")
    .update(verificationToken)
    .digest("hex");

  const hasEmail = await Email.findOne({ verificationToken: decodedToken });
  if (!hasEmail) {
    return next(
      new AppError(
        "Please provide a valid verification token or generate a new one",
        404
      )
    );
  }

  if (hasEmail?.userId?.toString() !== userId) {
    return next(
      new AppError("You are not authorized to perform this action", 401)
    );
  }

  if (hasEmail.isVerified) {
    return next(new AppError("Email already verified", 400));
  }

  if (hasEmail.verificationTokenExpires < Date.now()) {
    return next(
      new AppError("Token has been expired Please generate a new one!", 400)
    );
  }

  if (hasEmail.verificationToken !== decodedToken) {
    return next(new AppError("Please provide a valid verification token", 400));
  }

  hasEmail.isVerified = true;
  hasEmail.verificationToken = undefined;
  hasEmail.verificationTokenExpires = undefined;
  await hasEmail.save({ validateBeforeSave: false });

  res.status(200).json({
    status: "success",
    message: "Your e-mail address is now confirmed.",
  });
});

exports.setPrimaryEmailToController = CatchAsync(async (req, res, next) => {
  const { emailId } = req.body;
  const userId = req.userId;

  if (!emailId) {
    return next(new AppError("Please provide emailId", 400));
  }

  const user = await User.findById(userId);
  const hasEmail = await Email.findById(emailId);

  if (!hasEmail) {
    return next(new AppError("Email not found", 404));
  }

  if (hasEmail?.userId?.toString() !== userId) {
    return next(
      new AppError("You are not authorized to perform this action", 401)
    );
  }

  if (!hasEmail.isVerified) {
    return next(new AppError("Email not verified", 400));
  }

  [user.email, hasEmail.email] = [hasEmail.email, user.email];
  await user.save({ validateBeforeSave: false });
  await hasEmail.save({ validateBeforeSave: false });

  res.status(200).json({
    status: "success",
    message: "Your e-mail address is now confirmed.",
  });
});

exports.toggleLoginSecurityController = CatchAsync(async (req, res, next) => {
  const userId = req.userId;

  const user = await User.findById(userId);
  if (!user) {
    return next(new AppError("User not found", 404));
  }

  user.isLoginSecurity = !user.isLoginSecurity;
  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    status: "success",
    message: user.isLoginSecurity
      ? "Login Security Enabled"
      : "Login Security Disabled",
  });
});

exports.checkPasswordController = CatchAsync(async (req, res, next) => {
  const { password } = req.body;
  const userId = req.userId;

  const user = await User.findById(userId).select("+password");
  if (!user) {
    return next(new AppError("User not found", 404));
  }

  if (!(await user.isCorrectPassword(password))) {
    return next(
      new AppError(
        "The password you entered was incorrect, please try again.",
        400
      )
    );
  }
  user.passwordVerified = true;
  user.passwordVerifiedExpires = Date.now() + 5 * 60 * 1000;
  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    status: "success",
  });
});

exports.changePasswordController = CatchAsync(async (req, res, next) => {
  const { newPassword, confirmPassword } = req.body;
  const userId = req.userId;

  if (!newPassword || !confirmPassword) {
    return next(new AppError("Please provide required fields", 400));
  }

  if (newPassword !== confirmPassword) {
    return next(new AppError("Password does not match", 400));
  }

  const user = await User.findById(userId);
  if (!user) {
    return next(new AppError("User not found", 404));
  }

  if (!user.passwordVerified) {
    return next(new AppError("Please verify your password first", 400));
  }
  if (user.passwordVerifiedExpires < Date.now()) {
    return next(new AppError("Password verification has been expired", 400));
  }

  user.password = newPassword;
  user.passwordVerified = undefined;
  user.passwordVerifiedExpires = undefined;
  await user.save();

  user.password = res.status(200).json({
    status: "success",
    message: "Password changed",
  });
});

exports.updatePrivacyController = CatchAsync(async (req, res, next) => {
  let updatedPrivacy = {};

  const keys = [
    "isIndexable",
    "isAdultContent",
    "isEmailDiscoverable",
    "isLLM",
    "whoSendMessage",
    "isAllowedToComment",
    "isGifAutoPlay",
    "isAllowedToPromoteAnswers",
    "isNotifySubscribersOfNewQuestions",
  ];

  Object.keys(req.body).forEach((key) => {
    if (keys.includes(key) && req.body[key] !== undefined) {
      updatedPrivacy[key] = req.body[key];
    }
  });

  const userId = req.userId;
  await User.findByIdAndUpdate(userId, [
    {
      $set: {
        "settings.privacy": {
          $mergeObjects: ["$settings.privacy", updatedPrivacy],
        },
      },
    },
  ]);

  res.status(200).json({
    status: "success",
    message: "Privacy settings updated",
  });
});
exports.deleteAccountController = CatchAsync(async (req, res, next) => {
  const userId = req.userId;

  await Promise.all([
    User.findByIdAndDelete(userId),
    Email.deleteMany({ userId }),
    Question.deleteMany({ createdBy: userId }),
    Post.deleteMany({ createdBy: userId }),
    Report.deleteMany({ reporter: userId }),
  ]);

  res.status(200).json({
    status: "success",
    message: "Account deletion request successfully submitted ",
  });
});

exports.themeController = CatchAsync(async (req, res, next) => {
  const { theme } = req.body;
  const userId = req.userId;

  if (!theme) {
    return next(new AppError("Please provide theme", 400));
  }
  await User.findByIdAndUpdate(userId, {
    $set: { "settings.theme": theme },
  });

  res.status(200).json({
    status: "success",
    message: "Theme updated",
  });
});

exports.updateFontSizeController = CatchAsync(async (req, res, next) => {
  const { fontSize } = req.body;
  const userId = req.userId;

  if (!fontSize) {
    return next(new AppError("Please provide font size", 400));
  }

  await User.findByIdAndUpdate(userId, {
    $set: { "settings.fontSize": fontSize },
  });

  res.status(200).json({
    status: "success",
    message: "Font size updated",
  });
});

// profile
exports.getUserByUsernameController = CatchAsync(async (req, res, next) => {
  let { username, userId } = req.params;
  userId = userId !== "undefined" ? new ObjectId(userId) : req.userId;
  if (!username) {
    return next(new AppError("Please provide username", 400));
  }
  const user = await User.aggregate([
    {
      $match: {
        $and: [
          {
            $expr: {
              $eq: [
                {
                  $toLower: {
                    $replaceAll: {
                      input: "$username",
                      find: " ",
                      replacement: "-",
                    },
                  },
                },
                { $toLower: username },
              ],
            },
          },
          // { username: { $regex: new RegExp(`^${username}$`), $options: "iu" } },
          { isVerified: true },
        ],
      },
    },
    { $limit: 1 },
    {
      $addFields: {
        totalBookmarks: {
          $size: { $ifNull: ["$bookmarks", []] },
        },
        totalFollowers: {
          $size: { $ifNull: ["$followers", []] },
        },
        totalFollowing: {
          $size: { $ifNull: ["$following", []] },
        },
        isFollowing: {
          $in: [userId, "$followers"],
        },
      },
    },
    // lookup on posts and questions
    {
      $lookup: {
        from: "posts",
        localField: "_id",
        foreignField: "createdBy",
        as: "posts",
      },
    },
    {
      $lookup: {
        from: "questions",
        localField: "_id",
        foreignField: "createdBy",
        as: "questions",
      },
    },
    // add fields
    {
      $addFields: {
        totalAnswers: {
          $size: {
            $filter: {
              input: "$posts",
              as: "post",
              cond: {
                $and: [
                  { $eq: ["$$post.contentType", "answer"] },
                  { $eq: ["$$post.isDeleted", false] },
                ],
              },
            },
          },
        },
        totalPosts: {
          $size: {
            $filter: {
              input: "$posts",
              as: "post",
              cond: {
                $eq: ["$$post.contentType", "post"],
              },
            },
          },
        },
        totalQuestions: {
          $size: "$questions",
        },
        isOwnProfile: {
          $eq: [userId, "$_id"],
        },
      },
    },

    {
      $project: {
        _id: 1,
        active: 1,
        username: 1,
        email: 1,
        profilePicture: 1,
        createdAt: 1,
        updatedAt: 1,
        totalBookmarks: 1,
        totalFollowers: 1,
        totalFollowing: 1,
        isFollowing: 1,
        totalAnswers: 1,
        totalPosts: 1,
        totalQuestions: 1,
        isOwnProfile: 1,
        credentials: 1,
        dob: 1,
        posts: 1,
      },
    },
  ]);

  if (!user) {
    return next(new AppError("User not found", 404));
  }
  res.status(201).json({
    status: "success",
    user: user[0],
    username,
    params: req.params,
  });
});
exports.getFollowDataController = (isFollowing) => {
  return CatchAsync(async (req, res, next) => {
    const { _id } = req.body;
    const userId = new ObjectId(req.userId);
    const followType = isFollowing ? "following" : "followers";
    const followData = await User.aggregate([
      {
        $match: {
          _id: new ObjectId(_id),
        },
      },
      {
        $lookup: {
          from: "users",
          localField: followType,
          foreignField: "_id",
          as: followType,
        },
      },
      {
        $unwind: `$${followType}`,
      },
      {
        $replaceRoot: {
          newRoot: `$${followType}`,
        },
      },
      {
        $project: {
          _id: 1,
          username: 1,
          profilePicture: 1,
          totalFollowers: { $size: { $ifNull: ["$followers", []] } },
          isFollowing: {
            $in: [userId, "$followers"],
          },
          isOwnProfile: {
            $eq: [userId, "$_id"],
          },
          credentials: 1,
          createdAt: 1,
        },
      },
    ]);

    res.status(200).json({
      status: "success",
      [isFollowing ? "followings" : "followers"]: followData,
    });
  });
};
const getUsernameForUpdate = async (username) => {
  let name = username?.split("-")[0];
  const totalUserByUsername = await User.find({
    username: { $regex: new RegExp(`^${name}(-\\d+)?$`), $options: "iu" },
  }).countDocuments();

  if (totalUserByUsername === 0) {
    name = username;
  } else {
    name = `${name}-${totalUserByUsername}`;
  }
  return name;
};
exports.updateUsernameController = CatchAsync(async (req, res, next) => {
  const { username, profileId } = req.body;
  const userId = req.userId;

  if (userId !== profileId) {
    return next(new AppError("You can only update your username", 400));
  }
  // check if username is provided
  if (!username) {
    return next(new AppError("Please provide username", 400));
  }

  const user = await User.findById(profileId);

  if (!user) {
    return next(new AppError("User not found", 404));
  }
  if (user.maxUsernameUpdated > 10) {
    return next(
      new AppError("You have already updated your username 10 times")
    );
  }
  if (user.username === username) {
    user.maxUsernameUpdated++;
  } else {
    user.username = await getUsernameForUpdate(username);
    user.maxUsernameUpdated++;
  }

  await user.save({ validateBeforeSave: false });
  res.status(200).json({
    status: "success",
    message: "successfully updated.",
  });
});

const isEqual = (obj1, obj2) => {
  return JSON.stringify(obj1) === JSON.stringify(obj2);
};
exports.updateCredentialController = (credential) => {
  return CatchAsync(async (req, res, next) => {
    const userId = req.userId;
    const { profileId } = req.body;

    if (!profileId) {
      return next(new AppError("Please provide profileId", 400));
    }
    if (profileId !== userId) {
      return next(
        new AppError("You are not authorized to perform this action", 401)
      );
    }

    const type = typeof req.body[credential];
    let credentialValue = req.body[credential];

    // check if credential is not empty
    if (type === "object" && Object.keys(credentialValue).length === 0) {
      return next(new AppError(`Please provide ${credential}`, 400));
    }
    if (type === "string" && !credentialValue) {
      return next(new AppError(`Please provide ${credential}`, 400));
    }

    const user = await User.findById(userId);
    if (!user) {
      return next(new AppError("User not found", 404));
    }

    // check if credential already exists
    // for string
    if (type === "string" && user.credentials[credential] === credentialValue) {
      return res.status(200).json({
        status: "success",
        message: "successfully updated.",
      });
    }
    // for object
    if (
      type === "object" &&
      isEqual(user.credentials[credential], credentialValue)
    ) {
      return res.status(200).json({
        status: "success",
      });
    }

    // update
    if (["employment", "education", "location"].includes(credential)) {
      switch (credential) {
        case "employment":
          {
            const newEmployment =
              user.validateEmploymentCredential(credentialValue);

            if (!newEmployment) {
              return next(
                new AppError("Please add a company or position.", 400)
              );
            }
            user.credentials.employment = newEmployment;
          }
          break;
        case "education":
          {
            const newEducation =
              user.validateEducationCredential(credentialValue);
            if (!newEducation) {
              return next(new AppError("Please add a school or degree.", 400));
            }
            user.credentials.education = newEducation;
          }
          break;
        case "location":
          {
            const newLocation =
              user.validateLocationCredential(credentialValue);

            if (!newLocation) {
              return next(new AppError("Please add a location.", 400));
            }
            user.credentials.location = newLocation;
          }
          break;
        default:
          break;
      }
    } else {
      user.credentials[credential] =
        type === "string" ? credentialValue : JSON.stringify(credentialValue);
    }

    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      status: "success",
      message: "successfully updated.",
    });
  });
};

// get for user profile post|answer|question|space-following/follower|
exports.getAnswersController = CatchAsync(async (req, res, next) => {
  let { profileId, userId } = req.body;
  userId = userId ? new ObjectId(userId) : userId;

  const answers = await getAnswers({
    q: { createdBy: new ObjectId(profileId) },
    isSearch: false,
    userId,
    exclude: { questionId: { $exists: true } },
    sort: -1,
  });
  res.status(200).json({
    status: "success",
    answers,
    profileId,
    userId: req.headers,
  });
});
exports.getPostController = CatchAsync(async (req, res, next) => {
  let { profileId, userId } = req.body;
  userId = userId ? new ObjectId(userId) : userId;

  const posts = await getAnswers({
    q: { createdBy: new ObjectId(profileId) },
    isSearch: false,
    userId,
    exclude: { questionId: { $exists: false } },
    sort: -1,
  });
  res.status(200).json({
    status: "success",
    posts,
  });
});
exports.getQuestionsController = CatchAsync(async (req, res, next) => {
  let { profileId, userId } = req.body;
  userId = userId ? new ObjectId(userId) : userId;

  const questions = await getQuestions({
    q: { createdBy: new ObjectId(profileId) },
    isSearch: false,
    userId,
    sort: -1,
  });
  res.status(200).json({
    status: "success",
    questions,
  });
});

exports.uploadProfilePictureController = CatchAsync(async (req, res, next) => {
  const userId = req.userId;
  const { profilePicture, profileId } = req.body;

  if (!profilePicture || !profileId) {
    return next(
      new AppError("Please provide profilePicture and profileId", 400)
    );
  }
  if (userId !== profileId) {
    return next(new AppError("You can only update your profile picture", 400));
  }

  const user = await User.findById(profileId);
  // check is image file
  if (profilePicture.startsWith("data:image/")) {
  }

  user.profilePicture = profilePicture;
  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    status: "success",
    message: "successfully updated.",
  });
});

exports.updateViewsController = CatchAsync(async (req, res, next) => {});

exports.getMensionController = CatchAsync(async (req, res, next) => {
  const { username } = req.query;
  let mensions = [];
  if (username) {
    mensions = await User.aggregate([
      {
        $match: {
          username: { $regex: username, $options: "i" },
          isVerified: true,
        },
      },
      {
        $project: {
          name: "$username",
          avatar: "$profilePicture",
        },
      },
    ]);
  }

  res.status(200).json({
    status: "success",
    mensions,
  });
});
