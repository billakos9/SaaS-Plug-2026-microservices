import { Router } from "express";
import { postLogin, getValidate, postRegister, postRegisterProvider } from "../controllers/auth.controller.js";

const router = Router();

router.post("/login", postLogin);

router.post("/register", postRegister);

router.post("/internal/provider", postRegisterProvider);

router.get("/validate", getValidate);

export default router;
