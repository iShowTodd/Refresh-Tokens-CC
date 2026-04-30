import express from "express";
import dotenv from "dotenv";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { authRouter } from "./routes/auth";
import { userRouter } from "./routes/users";
import { PrismaClient } from "@prisma/client";

dotenv.config();

const app = express();
const prisma = new PrismaClient();

app.use(helmet());
app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: true, credentials: true }));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use(limiter);

app.use("/auth", authRouter(prisma));
app.use("/users", userRouter(prisma));

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Express app running on ${port}`));
