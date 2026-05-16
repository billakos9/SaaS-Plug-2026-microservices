import { Router } from "express";
import { postLogin, getValidate, postRegister } from "../controllers/auth.controller.js";

const router = Router();

router.post("/login", postLogin);

router.post("/register", postRegister);

router.get("/validate", getValidate);

export default router;
