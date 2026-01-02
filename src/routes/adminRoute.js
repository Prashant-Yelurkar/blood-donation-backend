import e, { Router } from "express";
import { gatAllAdmin, getAdminById, addAdmin , updateAdmin, deleteAdmin } from "../controller/adminController.js";
import { protect } from "../middleware/auth.js";
const router = Router();


router.get("/", protect, gatAllAdmin);
router.get("/:id", protect, getAdminById);
router.post("/", protect, addAdmin);

router.put("/:id", protect, updateAdmin);
router.delete("/:id", protect, deleteAdmin);


export default router;