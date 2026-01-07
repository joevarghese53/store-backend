import jwt from "jsonwebtoken";
import User from "../models/userModel.js";
import asyncHandler from "./asyncHandler.js";

const authenticate = asyncHandler(async (req, res, next) => {
  let token;

  // 1) Get token from Authorization header or cookie
  if (req.headers.authorization?.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies?.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) {
    res.status(401);
    throw new Error("Not authorized, no token");
  }

  // 2) Verify token
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3) Load user and attach to req
    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      res.status(401);
      throw new Error("Not authorized, user not found");
    }

    req.user = user;

    // (Optional: log minimal info in dev only)
    if (process.env.NODE_ENV === "development") {
      console.log("Authenticated user:", req.user.email);
    }

    next();
  } catch (err) {
    res.status(401);
    throw new Error("Not authorized, token failed");
  }
});

const authorizeAdmin = (req, res, next) => {
  if (req.user && req.user.isAdmin) {
    return next();
  }

  // 403 = authenticated but not allowed
  res.status(403);
  throw new Error("Not authorized as an admin");
};

export { authenticate, authorizeAdmin };


// ------------- Checked --------------------