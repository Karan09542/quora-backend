const express = require("express");
const {
  userSignupController,
  userSignupVarificationController,
  userLoginController,
  authorize,
  GetCurrentUserController,
  userForgetPasswordController,
  userUpdatePasswordController,
  refreshTokenController,
  fetchTitleController,
  userLogoutController,
  handleBookmarksController,
  userFollowingController,
  handlePrimaryLanguageController,
  addLanguageController,
  removeLanguageController,
  checkPasssword_And_Send_Confirmation_Email_Controller,
  removeAdditionalEmailController,
  confirmAdditionalEmailController,
  verifyAdditionalEmailController,
  setPrimaryEmailToController,
  logoutOfAllOtherDevicesController,
  toggleLoginSecurityController,
  checkPasswordController,
  changePasswordController,
  updatePrivacyController,
  deleteAccountController,
  themeController,
  updateFontSizeController,
  getFollowDataController,
  getUserByUsernameController,
  updateUsernameController,
  updateCredentialController,
  getAnswersController,
  getPostController,
  getQuestionsController,
  getMensionController,
  uploadProfilePictureController,
} = require("../controllers/UserController");
const { corsWithCredentials } = require("../utility/core_util");

const PublicUserRouter = express.Router();
PublicUserRouter.post("/signup", userSignupController);
PublicUserRouter.post("/verify-email", userSignupVarificationController);
PublicUserRouter.post("/login", userLoginController);
PublicUserRouter.post("/logout", corsWithCredentials, userLogoutController);
PublicUserRouter.post(
  "/logout-of-all-other-devices",
  corsWithCredentials,
  logoutOfAllOtherDevicesController
);
PublicUserRouter.post("/forgot-password", userForgetPasswordController);
PublicUserRouter.post("/update-password", userUpdatePasswordController);
PublicUserRouter.post(
  "/refresh-token",
  corsWithCredentials,
  refreshTokenController
);
// profile
PublicUserRouter.post("/followers", getFollowDataController(false));
PublicUserRouter.post("/followings", getFollowDataController(true));
// answer|questions|posts
PublicUserRouter.post("/answer", getAnswersController);
PublicUserRouter.post("/post", getPostController);
PublicUserRouter.post("/questions", getQuestionsController);
PublicUserRouter.post(
  "/profile/:username/:userId",
  getUserByUsernameController
);

const PrivateUserRouter = express.Router();
PrivateUserRouter.use(authorize);

PrivateUserRouter.post("/", corsWithCredentials, GetCurrentUserController);
PrivateUserRouter.post("/fetch-title", fetchTitleController);
PrivateUserRouter.post("/handle-bookmarks", handleBookmarksController);
PrivateUserRouter.post("/handle-following", userFollowingController);

PrivateUserRouter.post(
  "/set-primary-language",
  handlePrimaryLanguageController
);
PrivateUserRouter.post("/add-language", addLanguageController);
PrivateUserRouter.post("/remove-language", removeLanguageController);
PrivateUserRouter.post(
  "/check-password-and-add-additional-email",
  checkPasssword_And_Send_Confirmation_Email_Controller
);

PrivateUserRouter.post(
  "/remove-additional-email",
  removeAdditionalEmailController
);

PrivateUserRouter.post(
  "/confirm-additional-email",
  confirmAdditionalEmailController
);

PrivateUserRouter.post(
  "/verify-additional-email",
  verifyAdditionalEmailController
);

PrivateUserRouter.post("/set-primary-email", setPrimaryEmailToController);
PrivateUserRouter.post("/toggle-login-security", toggleLoginSecurityController);

PrivateUserRouter.post("/check-password", checkPasswordController);
PrivateUserRouter.post("/change-password", changePasswordController);
PrivateUserRouter.post("/update-privacy", updatePrivacyController);

PrivateUserRouter.post("/delete-account", deleteAccountController);
PrivateUserRouter.post("/theme", themeController);
PrivateUserRouter.post("/font-size", updateFontSizeController);

// profile

PrivateUserRouter.post("/update-username", updateUsernameController);
PrivateUserRouter.post(
  "/update-profile",
  updateCredentialController("profile")
);
PrivateUserRouter.post(
  "/update-description",
  updateCredentialController("description")
);

PrivateUserRouter.post(
  "/update-employment",
  updateCredentialController("employment")
);
PrivateUserRouter.post(
  "/update-education",
  updateCredentialController("education")
);
PrivateUserRouter.post(
  "/update-location",
  updateCredentialController("location")
);

// views
PrivateUserRouter.post("/views");
PrivateUserRouter.post("/mension", getMensionController);
PrivateUserRouter.post(
  "/upload-profile-picture",
  uploadProfilePictureController
);
module.exports = { PublicUserRouter, PrivateUserRouter };
