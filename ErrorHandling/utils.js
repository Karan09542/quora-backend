const AppError = require("./AppError");

exports.CatchAsync = (fn)=> {
    return async (req, res, next) => {
        await fn(req, res, next).catch(next);
    }
}

exports.sendErrorDev = (err, res) => {
    res.status(err.statusCode).json({
        status: err.status,
        message: err.message,
        stack: err.stack
    })
}

exports.sendErrorProd = (err, res)=> {
    if(err.statusCode === 500){
        res.status(500).json({
            status: err.status,
            message: "Oh something bad happend!"
        });
        return;
    } else {
        res.status(err.statusCode).json({
            status: err.status,
            message: err.message,
        })
    }
}

exports.handleJWTError = () =>
    new AppError(`Invalid Token, Please log in again`, 401);
exports.handleJWTExpiredError = () =>
    new AppError("Your token has been expired Please log in again", 401)