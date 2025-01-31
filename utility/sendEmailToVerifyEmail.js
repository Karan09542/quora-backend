const htmlTemplate = require("../utility/htmlTemplate.json");
const { sendEmail } = require("../utility/sendEmail");

exports.sendEmailToVerifyEmail = async (res, user) => {
  const [verificationToken, otp] = user.createVerificationToken();
  await user.save({ validateBeforeSave: false });

  const options = {
    email: user?.email,
    username: user?.username,
    subject: "Verify Your Email Address",
    message:
      "Thank you for registering with us! To complete your registration, please verify your email address by clicking the button below.",
    path: "verify-email",
    token: verificationToken,
    html: htmlTemplate["emailVerification"],
  };
  await sendEmail(options);
  res.status(201).json({
    status: "success",
    message:
      "an email has been sent to your email address. Please verify your email address",
    otp,
  });
};
