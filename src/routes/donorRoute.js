import e, { Router } from "express";
import { getAllDonor, getDonorById, addDonor , updateDonor, deleteDonor } from "../controller/donorController.js";
import { protect } from "../middleware/auth.js";
const router = Router();


router.get("/", protect, getAllDonor);
router.get("/:id", protect, getDonorById);
router.post("/", protect, addDonor);
router.put("/:id", protect, updateDonor);
router.delete("/:id", protect, deleteDonor);

export default router;