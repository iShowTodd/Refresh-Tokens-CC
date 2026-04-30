import { Controller, Post, Body, Req, Res } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { Request, Response } from "express";

@Controller("auth")
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post("register")
  async register(@Body() body: any) {
    return this.auth.register(body.name, body.email, body.password);
  }

  @Post("login")
  async login(@Body() body: any, @Res({ passthrough: true }) res: Response) {
    const user = await this.auth.validateUser(body.email, body.password);
    if (!user) throw new Error("Invalid credentials");
    const access = this.auth.signAccessToken({ sub: user.id, role: user.role });
    const raw = this.auth.signRefreshToken();
    const hash = this.auth.hashToken(raw);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    // persist
    const prisma = new (require("@prisma/client").PrismaClient)();
    await prisma.session.create({
      data: { userId: user.id, tokenHash: hash, expiresAt },
    });
    res.cookie("refreshToken", raw, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });
    return { access };
  }

  @Post("refresh")
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const raw = req.cookies["refreshToken"];
    if (!raw) throw new Error("Missing token");
    const hash = this.auth.hashToken(raw);
    const prisma = new (require("@prisma/client").PrismaClient)();
    const session = await prisma.session.findFirst({
      where: { tokenHash: hash },
    });
    if (!session) throw new Error("Invalid token");
    await prisma.session.update({
      where: { id: session.id },
      data: { revoked: true },
    });
    const rawNew = this.auth.signRefreshToken();
    const newHash = this.auth.hashToken(rawNew);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma.session.create({
      data: { userId: session.userId, tokenHash: newHash, expiresAt },
    });
    const access = this.auth.signAccessToken({ sub: session.userId });
    res.cookie("refreshToken", rawNew, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });
    return { access };
  }
}
