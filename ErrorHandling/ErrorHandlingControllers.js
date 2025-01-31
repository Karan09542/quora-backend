const {
  handleJWTError,
  handleJWTExpiredError,
  handleMongoServerError,
  handleMongoValidationError,
  sendErrorProd,
  sendErrorDev,
} = require("./utils");

exports.globalErrorHandlingController = (err, req, res, next) => {
  // if (err.name === "JsonWebTokenError") err =  handleJWTError();
  if (err.name === "TokenExpiredError") err = handleJWTExpiredError();
  // if (err.name === "MongoServerError") err = handleMongoServerError();
  // if(err.name === "ValidationError") err = handleMongoValidationError();
  console.log(err);
  err.statusCode = err.statusCode || 500;
  err.message = err.message || "Internal server error";
  err.status = err.status || "error";

  if (process.env.NODE_ENV === "production") {
    // logic
    sendErrorProd(err, res);
  } else {
    // developer
    sendErrorDev(err, res);
  }
};
exports.unHandleRoutesController = (req, res) => {
  res.status(400).json({
    status: "fail",
    message: `Page Not Found? cannot find ${req.originalUrl} on this server `,
  });
};
