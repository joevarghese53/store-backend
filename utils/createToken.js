// utils/createToken.js
import jwt from "jsonwebtoken";
import { createRefreshTokenDoc } from "./refreshTokenDocHelper.js";

const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const BUFFER_MS = 24 * 60 * 60 * 1000;

const generateTokens = async (req, res, user) => {
  const accessToken = jwt.sign(
    {
      userId: user._id,
      isAdmin: user.isAdmin,
    },
    process.env.JWT_SECRET,
    { expiresIn: "15m" }
  );

  const { plain: refreshPlain } = await createRefreshTokenDoc({
    userId: user._id,
    ip: req.ip || "",
    userAgent: req.get("user-agent") || "",
    ttlMs: REFRESH_TTL_MS,
    bufferMs: BUFFER_MS,
  });

  res.cookie("refreshToken", refreshPlain, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
    maxAge: REFRESH_TTL_MS,
    path: "/api/users/refresh-token",
  });

  return accessToken;
};

export default generateTokens;

// ---------- Checked ----------