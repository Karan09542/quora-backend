const nodemailer = require("nodemailer");

exports.sendEmail = async (options) => {
  let html = options.html;
  html = html
    .replace("{{subject}}", options.subject)
    .replace("{{message}}", options.message)
    .replace(
      "{{username}}",
      [undefined, null, ""].includes(options.username) ? "" : options.username
    )
    .replaceAll(
      "{{url}}",
      `${
        (process.env.FRONTEND_URL && process.env.FRONTEND_URL + "/") ||
        "http://localhost:5173/"
      }${options.path}?token=${options.token}`
    );

  html = html
    .replaceAll(
      "{{website}}",
      `${
        (process.env.FRONTEND_URL && process.env.FRONTEND_URL + "/") ||
        "http://localhost:5173/"
      }`
    )
    .replace("{{email}}", options.email);

  const transporter = nodemailer.createTransport({
    // if mailtrap

    // host: process.env.EMAIL_HOST,
    // port: process.env.EMAIL_PORT,

    // if google
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  const mailOptions = {
    from: "Sitaram Gourishankar",
    to: options.email,
    subject: options.subject,
    text: options.message,
    html: html,
  };

  console.log("email sending to " + options.email);
  await transporter.sendMail(mailOptions);
  console.log("email sent to " + options.email);
};
