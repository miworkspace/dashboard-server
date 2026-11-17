export const notFound = (req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found",
  });
};

export const errorHandler = (error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  console.error(error);

  let status = 500;
  let message = "Internal server error";

  if (error.name === "ValidationError") {
    status = 400;
    message = "Validation failed";
  } else if (error.name === "CastError") {
    status = 400;
    message = "Invalid resource identifier";
  } else if (error.code === 11000) {
    status = 409;
    message = "A record with this value already exists";
  } else if (
    error instanceof SyntaxError &&
    error.status === 400 &&
    "body" in error
  ) {
    status = 400;
    message = "Invalid JSON body";
  }

  res.status(status).json({
    success: false,
    message,
  });
};
