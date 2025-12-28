import e, { Router } from "express";
import { getAllDonor, getDonorById, addDonor , updateDonor, deleteDonor,seedDonor } from "../controller/donorController.js";
import { protect } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
const router = Router();


router.get("/", protect, getAllDonor);
router.get("/:id", protect, getDonorById);
router.post("/", protect, addDonor);
router.put("/:id", protect, updateDonor);
router.delete("/:id", protect, deleteDonor);

router.post("/seed",protect,upload.single("file"), seedDonor )

export default router;