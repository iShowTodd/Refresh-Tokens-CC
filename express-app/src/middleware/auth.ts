import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const auth = req.get("authorization");
  if (!auth) return res.status(401).json({ error: "Missing auth" });
  const token = auth.split(" ")[1];
  try {
    const payload = jwt.verify(
      token,
      process.env.JWT_ACCESS_SECRET || "access_secret",
    );
    (req as any).user = payload;
    return next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

export function requireRole(role: string) {
  return function (req: Request, res: Response, next: NextFunction) {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: "Missing auth" });
    if (user.role !== role) return res.status(403).json({ error: "Forbidden" });
    return next();
  };
}
