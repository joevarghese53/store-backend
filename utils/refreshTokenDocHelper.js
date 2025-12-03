// utils/refreshTokenDocHelper.js
import crypto from "crypto";
import RefreshToken from "../models/refreshTokenModel.js"; // use your canonical path
import { hashToken } from "./hashTokenHelper.js"; // or inline

const createRandomString = () => crypto.randomBytes(64).toString("hex");

export async function createRefreshTokenDoc({ userId, ip = "", userAgent = "", ttlMs = 7*24*60*60*1000, bufferMs = 24*60*60*1000 }) {
  // Try up to N times to create a unique token; always regenerate plain+hash together
  for (let i = 0; i < 3; i++) {
    const plain = createRandomString();
    const tokenHash = hashToken(plain);

    const expiresAt = new Date(Date.now() + ttlMs);
    const deleteAfter = new Date(expiresAt.getTime() + bufferMs);

    try {
      const doc = await RefreshToken.create({
        userId,
        tokenHash,
        expiresAt,
        deleteAfter,
        createdByIp: ip,
        createdByUserAgent: userAgent,
      });

      return { plain, doc }; // success: return the plain token and the saved document
    } catch (err) {
      if (err.code === 11000) {
        // duplicate hash — retry with a fresh plain/hash
        continue;
      }
      throw err;
    }
  }
  throw new Error("Failed to create unique refresh token after retries");
}
