// createToken.js
import jwt from "jsonwebtoken";

const generateToken = (res, userId) => {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });

  res.cookie('jwt', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'None' : 'Lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/', // Ensure the cookie is available throughout the site
});

console.log('Cookie set:', res.getHeader('Set-Cookie')); // Log the cookie header

  return token;
};

export default generateToken;
