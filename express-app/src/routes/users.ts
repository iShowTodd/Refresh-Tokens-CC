import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { requireAuth, requireRole } from "../middleware/auth";

export const userRouter = (prisma: PrismaClient) => {
  const r = Router();

  r.get("/me", requireAuth, async (req: any, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!user) return res.status(404).json({});
    return res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  });

  r.get(
    "/admin/dashboard",
    requireAuth,
    requireRole("admin"),
    async (_req, res) => {
      return res.json({ secret: "admin data" });
    },
  );

  return r;
};
