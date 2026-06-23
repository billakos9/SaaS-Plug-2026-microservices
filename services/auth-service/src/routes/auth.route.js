import { Router } from "express";
import { postLogin, getValidate, postRegister, postRegisterProvider, postSelfRegisterProvider, postRegisterAdmin } from "../controllers/auth.controller.js";
import { requireAdminAuth } from "../middleware/auth.middleware.js";

const router = Router();

router.post("/login", postLogin);
router.post("/register", postRegister);
router.post("/provider/register", postSelfRegisterProvider);      // public — registration code gate
router.post("/internal/provider", postRegisterProvider);          // internal — called by admin-service
router.post("/admin/register", requireAdminAuth, postRegisterAdmin); // protected — admin JWT required
router.get("/validate", getValidate);

export default router;
