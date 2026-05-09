import { Router } from "express";
import {
  deleteUser,
  getAllUsers,
  getCurrentUser,
  getUserById,
} from "../controllers/user.controller.js";
import authMiddleware from "../middleware/auth.middleware.js";

const userRouter = Router();

userRouter.get("/", getAllUsers);
userRouter.get("/me", authMiddleware, getCurrentUser);
userRouter.get("/:id", getUserById);
userRouter.delete("/delete/:id", deleteUser);

export default userRouter;
