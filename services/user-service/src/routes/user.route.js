import { Router } from "express";
import {
  deleteUser,
  getAllUsers,
  getCurrentUser,
  getUserById,
  updateCurrentUser,
} from "../controllers/user.controller.js";
import authMiddleware, { requireRole } from "../middleware/auth.middleware.js";

const userRouter = Router();

userRouter.get("/", authMiddleware, requireRole("admin"), getAllUsers);
userRouter.get("/me", authMiddleware, getCurrentUser);
userRouter.put("/me", authMiddleware, updateCurrentUser);
userRouter.get("/:id", authMiddleware, requireRole("admin"), getUserById);
userRouter.delete("/delete/:id", authMiddleware, requireRole("admin"), deleteUser);

export default userRouter;
