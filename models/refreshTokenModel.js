import mongoose from "mongoose";

const refreshTokenSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "User" },
  tokenHash: { type: String, required: true, index: true, unique: true },
  expiresAt: { type: Date, required: true },
  deleteAfter: { type: Date, index: { expires: 0 } },
  revokedAt: { type: Date },
  replacedByToken: { type: mongoose.Schema.Types.ObjectId, ref: "RefreshToken" },
  createdByIp: { type: String },
  createdByUserAgent: { type: String },
  lastUsedAt: { type: Date },
  lastUsedIp: { type: String },
  lastUsedUserAgent: { type: String },
}, { timestamps: true });

refreshTokenSchema.virtual("isExpired").get(function() {
  return Date.now() >= this.expiresAt;
});

refreshTokenSchema.virtual("isActive").get(function() {
  return !this.revokedAt && !this.isExpired;
});

export default mongoose.model("RefreshToken", refreshTokenSchema);
