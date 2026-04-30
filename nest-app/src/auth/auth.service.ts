import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";
import * as crypto from "crypto";
import * as jwt from "jsonwebtoken";

const prisma = new PrismaClient();

@Injectable()
export class AuthService {
  async register(name: string, email: string, password: string) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new Error("Email exists");
    const passwordHash = await bcrypt.hash(password, 10);
    return prisma.user.create({ data: { name, email, passwordHash } });
  }

  async validateUser(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return null;
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return null;
    return user;
  }

  signAccessToken(payload: object) {
    return jwt.sign(payload, process.env.JWT_ACCESS_SECRET || "access_secret", {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRES || "15m",
    });
  }

  signRefreshToken() {
    return crypto.randomBytes(64).toString("hex");
  }

  hashToken(token: string) {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  async rotateRefreshSession(
    sessionId: string,
    userId: string,
    deviceName?: string,
    ip?: string,
    ua?: string,
  ) {
    await prisma.session.update({
      where: { id: sessionId },
      data: { revoked: true },
    });
    const raw = this.signRefreshToken();
    const hash = this.hashToken(raw);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma.session.create({
      data: {
        userId,
        tokenHash: hash,
        deviceName,
        ipAddress: ip,
        userAgent: ua,
        expiresAt,
      },
    });
    return raw;
  }
}
