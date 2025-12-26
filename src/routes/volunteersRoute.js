import e, { Router } from "express";
import { addVolunteer, deleteVolunteer, getAllVolunteers, getVolunteerById, updateVolunteer } from "../controller/volunteersController.js";
import { protect } from "../middleware/auth.js";
const router = Router();


router.get("/", protect, getAllVolunteers);
router.get("/:id", protect, getVolunteerById);
router.post("/", protect, addVolunteer);
router.put("/:id", protect, updateVolunteer);
router.delete("/:id", protect, deleteVolunteer);

export default router;