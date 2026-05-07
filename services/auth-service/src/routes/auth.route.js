import { Router } from "express";
import { postLogin, getValidate } 
from "../controllers/auth.controller.js";

const router = Router();

router.post("/login", postLogin);

router.get("/validate", getValidate);

export default router;