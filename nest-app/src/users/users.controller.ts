import { Controller, Get, Req } from "@nestjs/common";
import { Request } from "express";

@Controller("users")
export class UsersController {
  @Get("me")
  async me(@Req() req: Request) {
    // placeholder: in real app use AuthGuard to populate user
    return { message: "protected route - implement guard in production" };
  }
}
