const { CatchAsync } = require("../ErrorHandling/utils");
const Report = require("../models/ReportModel");

exports.report = CatchAsync(async (req, res, next) => {
  const { reportedContent, contentType, reason, additionalInfo, reasonType } =
    req.body;
  const reporter = req.userId;
  if (!reportedContent || !contentType || !reason) {
    res.status(400).json({
      status: "fail",
      message: "Please provide required fields",
    });
  }

  await Report.create({
    reporter,
    reportedContent,
    contentType,
    reason,
    additionalInfo,
    reasonType: reasonType || undefined,
  });
  res.status(200).json({
    status: "success",
    message: "reported successfully",
  });
});
