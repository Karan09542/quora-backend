const express = require("express");
const app = express();
const path = require("path");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const {
  unHandleRoutesController,
  globalErrorHandlingController,
} = require("./ErrorHandling/ErrorHandlingControllers");

const dotenv = require("dotenv");
const { PublicUserRouter, PrivateUserRouter } = require("./routes/UserRouter");
const QuestionRouter = require("./routes/QuestionRouter");
const PostRouter = require("./routes/PostRouter");
const ReporterRouter = require("./routes/ReportRouter");
const { NotificationPreferenceRouter } = require("./routes/PreferenceRouter");
const SearchRouter = require("./routes/SearchRouter");
const BookmarkRouter = require("./routes/BookmarkRouter");
const {
  PrivateCommentRouter,
  PublicCommentRouter,
} = require("./routes/CommentRouter");
dotenv.config({ path: "./.env" });

const MongoStore = require("connect-mongo");
const { corsWithoutCredentials } = require("./utility/core_util");

// app.use(corsWithoutCredentials);

app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    store: MongoStore.create({
      mongoUrl: `${process.env.DB_URL.replace(
        "<password>",
        process.env.DB_PASSWORD
      )}/quoraSession`,
      ttl: 7 * 60,
      autoRemove: "interval",
      autoRemoveInterval: 1, // Check every 1 minute
    }),
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 7 * 60 * 1000,
    },
  })
);

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json({ limit: "50mb" }));

app.use("/user", PublicUserRouter);
app.use("/user", PrivateUserRouter);

app.use("/question", QuestionRouter);
app.use("/post", PostRouter);
app.use("/report", ReporterRouter);
app.use("/preference", NotificationPreferenceRouter);
app.use("/search-result", SearchRouter);
app.use("/book-mark", BookmarkRouter);

app.use("/comment", PublicCommentRouter);
app.use("/comment", PrivateCommentRouter);

app.get("/", (req, res) => {
  res.send("हर हर महादेव");
});

app.all("*", unHandleRoutesController);
app.use(globalErrorHandlingController);

module.exports = app;
