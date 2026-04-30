import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { z } from "zod";
import { signAccessToken, signRefreshToken, hashToken } from "../utils/jwt";

const router = Router();

export const authRouter = (prisma: PrismaClient) => {
  const r = Router();

  const registerSchema = z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(6),
  });

  r.post("/register", async (req: Request, res: Response) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.format() });
    const { name, email, password } = parsed.data;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ error: "Email exists" });
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, passwordHash },
    });
    return res.json({ id: user.id, email: user.email, name: user.name });
  });

  const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    deviceName: z.string().optional(),
  });

  r.post("/login", async (req: Request, res: Response) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: parsed.error.format() });
    const { email, password, deviceName } = parsed.data;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const accessToken = signAccessToken({ sub: user.id, role: user.role });
    const rawRefresh = signRefreshToken({ sub: user.id });
    const tokenHash = hashToken(rawRefresh);
    const expiresAt = new Date(
      Date.now() + parseDuration(process.env.REFRESH_TOKEN_EXPIRES || "7d"),
    );

    await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash,
        deviceName: deviceName || "unknown",
        ipAddress: req.ip,
        userAgent: req.get("user-agent") || undefined,
        expiresAt,
      },
    });

    res.cookie("refreshToken", rawRefresh, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 7,
    });
    return res.json({ accessToken });
  });

  r.post("/refresh", async (req: Request, res: Response) => {
    const raw = req.cookies["refreshToken"];
    if (!raw) return res.status(401).json({ error: "Missing refresh token" });
    const tokenHash = hashToken(raw);
    const session = await prisma.session.findFirst({ where: { tokenHash } });
    if (!session || session.revoked || session.expiresAt < new Date()) {
      return res.status(401).json({ error: "Invalid refresh token" });
    }

    // rotate: revoke old
    await prisma.session.update({
      where: { id: session.id },
      data: { revoked: true },
    });
    const rawNew = signRefreshToken({ sub: session.userId });
    const newHash = hashToken(rawNew);
    const expiresAt = new Date(
      Date.now() + parseDuration(process.env.REFRESH_TOKEN_EXPIRES || "7d"),
    );
    await prisma.session.create({
      data: {
        userId: session.userId,
        tokenHash: newHash,
        deviceName: session.deviceName,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
        expiresAt,
      },
    });

    const accessToken = signAccessToken({ sub: session.userId });
    res.cookie("refreshToken", rawNew, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 7,
    });
    return res.json({ accessToken });
  });

  r.post("/logout", async (req: Request, res: Response) => {
    const raw = req.cookies["refreshToken"];
    if (!raw) return res.status(204).send();
    const tokenHash = hashToken(raw);
    await prisma.session.updateMany({
      where: { tokenHash },
      data: { revoked: true },
    });
    res.clearCookie("refreshToken");
    return res.status(200).json({ ok: true });
  });

  r.post("/logout-all", async (req: Request, res: Response) => {
    // For simplicity we expect an access token in Authorization
    const auth = req.get("authorization");
    if (!auth) return res.status(401).json({ error: "Missing access token" });
    try {
      const payload: any = require("jsonwebtoken").verify(
        auth.split(" ")[1],
        process.env.JWT_ACCESS_SECRET || "access_secret",
      );
      await prisma.session.updateMany({
        where: { userId: payload.sub },
        data: { revoked: true },
      });
      res.clearCookie("refreshToken");
      return res.json({ ok: true });
    } catch (e) {
      return res.status(401).json({ error: "Invalid access token" });
    }
  });

  return r;
};

function parseDuration(input: string) {
  // supports '7d' or minutes '15m'
  const m = input.match(/(\d+)([smhd])/);
  if (!m) return 7 * 24 * 60 * 60 * 1000;
  const n = parseInt(m[1], 10);
  const u = m[2];
  if (u === "s") return n * 1000;
  if (u === "m") return n * 60 * 1000;
  if (u === "h") return n * 60 * 60 * 1000;
  if (u === "d") return n * 24 * 60 * 60 * 1000;
  return n;
}
