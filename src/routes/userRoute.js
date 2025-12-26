import e, { Router } from "express";
import { getAllUsers, seedUser } from "../controller/userController.js";
import { protect } from "../middleware/auth.js";
const router = Router();

// router.get("/", (req, res) => {
//   res.send("User Route Working");
// });

router.get('/seed' , seedUser)
router.get('/' , protect, getAllUsers)

export default router;