// createToken.js
import jwt from "jsonwebtoken";

const generateTokens = (res, userId) => {
  const accessToken = jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: "15m", // short-lived access token
  });

  const refreshToken = jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: "7d", // long-lived refresh token
  });

  console.log("Generated refresh token:", refreshToken);
  console.log("Secret used:", process.env.JWT_REFRESH_SECRET.slice(0, 10) + '...');
  // Set refresh token in HTTP-only cookie
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  });

  // Return access token (can be stored in memory on frontend)
  return accessToken;
};

export default generateTokens;
