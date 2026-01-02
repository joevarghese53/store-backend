// middlewares/errorHandler.js

// NotFound Handler (for unknown routes)
const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

// Main Error Handler
const errorHandler = (err, req, res, next) => {
  console.error("❌ Error:", err);

  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;

  res.status(statusCode).json({
    success: false,
    message: err.message || "Internal Server Error",
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
};

export {
  notFound,
  errorHandler
}

// ------------- Checked --------------------