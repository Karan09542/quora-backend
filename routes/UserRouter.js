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
const {
  corsWithCredentials,
  corsWithoutCredentials,
} = require("../utility/core_util");

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

PrivateUserRouter.post(
  "/fetch-title",
  corsWithoutCredentials,
  fetchTitleController
);
PrivateUserRouter.post(
  "/handle-bookmarks",
  corsWithoutCredentials,
  handleBookmarksController
);
PrivateUserRouter.post(
  "/handle-following",
  corsWithoutCredentials,
  userFollowingController
);

PrivateUserRouter.post(
  "/set-primary-language",
  corsWithoutCredentials,
  handlePrimaryLanguageController
);
PrivateUserRouter.post(
  "/add-language",
  corsWithoutCredentials,
  addLanguageController
);
PrivateUserRouter.post(
  "/remove-language",
  corsWithoutCredentials,
  removeLanguageController
);
PrivateUserRouter.post(
  "/check-password-and-add-additional-email",
  corsWithoutCredentials,
  checkPasssword_And_Send_Confirmation_Email_Controller
);

PrivateUserRouter.post(
  "/remove-additional-email",
  corsWithoutCredentials,
  removeAdditionalEmailController
);

PrivateUserRouter.post(
  "/confirm-additional-email",
  corsWithoutCredentials,
  confirmAdditionalEmailController
);

PrivateUserRouter.post(
  "/verify-additional-email",
  corsWithoutCredentials,
  verifyAdditionalEmailController
);

PrivateUserRouter.post(
  "/set-primary-email",
  corsWithoutCredentials,
  setPrimaryEmailToController
);
PrivateUserRouter.post(
  "/toggle-login-security",
  corsWithoutCredentials,
  toggleLoginSecurityController
);

PrivateUserRouter.post(
  "/check-password",
  corsWithoutCredentials,
  checkPasswordController
);
PrivateUserRouter.post(
  "/change-password",
  corsWithoutCredentials,
  changePasswordController
);
PrivateUserRouter.post(
  "/update-privacy",
  corsWithoutCredentials,
  updatePrivacyController
);

PrivateUserRouter.post(
  "/delete-account",
  corsWithoutCredentials,
  deleteAccountController
);
PrivateUserRouter.post("/theme", corsWithoutCredentials, themeController);
PrivateUserRouter.post(
  "/font-size",
  corsWithoutCredentials,
  updateFontSizeController
);

// profile

PrivateUserRouter.post(
  "/update-username",
  corsWithoutCredentials,
  updateUsernameController
);
PrivateUserRouter.post(
  "/update-profile",
  corsWithoutCredentials,
  updateCredentialController("profile")
);
PrivateUserRouter.post(
  "/update-description",
  corsWithoutCredentials,
  updateCredentialController("description")
);

PrivateUserRouter.post(
  "/update-employment",
  corsWithoutCredentials,
  updateCredentialController("employment")
);
PrivateUserRouter.post(
  "/update-education",
  corsWithoutCredentials,
  updateCredentialController("education")
);
PrivateUserRouter.post(
  "/update-location",
  corsWithoutCredentials,
  updateCredentialController("location")
);

// views
PrivateUserRouter.post("/views");
PrivateUserRouter.post(
  "/mension",
  corsWithoutCredentials,
  getMensionController
);
PrivateUserRouter.post(
  "/upload-profile-picture",
  corsWithoutCredentials,
  uploadProfilePictureController
);
module.exports = { PublicUserRouter, PrivateUserRouter };
