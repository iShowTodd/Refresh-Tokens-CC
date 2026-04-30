import jwt from "jsonwebtoken";
import crypto from "crypto";

const accessSecret = process.env.JWT_ACCESS_SECRET || "access_secret";
const refreshSecret = process.env.JWT_REFRESH_SECRET || "refresh_secret";

export function signAccessToken(payload: object) {
  return jwt.sign(payload, accessSecret, {
    expiresIn: process.env.ACCESS_TOKEN_EXPIRES || "15m",
  });
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, accessSecret);
}

export function signRefreshToken(payload: object) {
  // We return a random token (opaque) and store a hash in DB
  const token = crypto.randomBytes(64).toString("hex");
  return token;
}

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
