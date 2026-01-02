import e, { Router } from "express";
import {  addEvent , deleteEvent , getAllEvent, getEventDetailsById, getEventPermission, getEventReport, getRegisteredUsersByEvent, getUnregisteredUsersByEvent ,registerUsersToEventFromFile, registerUserToEvent, updateEvent, updateEventAttendeeStatus} from "../controller/eventController.js";
import { protect } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
const router = Router();


router.get("/", protect, getAllEvent);
router.get("/:id", protect, getEventDetailsById);
router.post("/", protect, addEvent);
router.post("/:id", protect, updateEvent);

// router.put("/:id", protect, updateEvent);
router.delete("/:id", protect, deleteEvent);
router.get("/:id/user", protect, getRegisteredUsersByEvent);
router.get("/:id/permissions", protect, getEventPermission);

router.get("/:id/user/unregister", protect, getUnregisteredUsersByEvent);
router.post("/:id/registerUser", protect, registerUserToEvent);
router.post("/:id/userStatus/:userId", protect, updateEventAttendeeStatus);

router.post("/:id/register-bulk",protect,upload.single("file"), registerUsersToEventFromFile )
router.get("/:eventId/report", getEventReport);

export default router;