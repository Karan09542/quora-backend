const express = require("express");
const {
  getNotificationPreferencesController,
  updateNotificationPreferencesController,
} = require("../controllers/PreferenceController");
const { authorize } = require("../controllers/UserController");

const NotificationPreferenceRouter = express.Router();
NotificationPreferenceRouter.use(authorize);

NotificationPreferenceRouter.post(
  "/notification",
  getNotificationPreferencesController
);
NotificationPreferenceRouter.post(
  "/notification/update",
  updateNotificationPreferencesController
);

module.exports = { NotificationPreferenceRouter };
