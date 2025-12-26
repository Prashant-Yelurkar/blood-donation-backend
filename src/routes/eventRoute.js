import e, { Router } from "express";
import {  addEvent , deleteEvent , getAllEvent, getEventDetailsById, getRegisteredUsersByEvent, getUnregisteredUsersByEvent, registerUserToEvent, updateEventAttendeeStatus} from "../controller/eventController.js";
import { protect } from "../middleware/auth.js";
const router = Router();


router.get("/", protect, getAllEvent);
router.get("/:id", protect, getEventDetailsById);
router.post("/", protect, addEvent);
// router.put("/:id", protect, updateEvent);
router.delete("/:id", protect, deleteEvent);
router.get("/:id/user", protect, getRegisteredUsersByEvent);
router.get("/:id/user/unregister", protect, getUnregisteredUsersByEvent);
router.post("/:id/registerUser", protect, registerUserToEvent);
router.post("/:id/userStatus/:userId", protect, updateEventAttendeeStatus);


export default router;