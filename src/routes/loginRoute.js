import { Router  } from "express";
const router = Router();
import {login} from "../controller/loginController.js";
import { protect } from "../middleware/auth.js";
import UserProfile from "../models/userProfile.model.js";
import connectDB from "../config/db.js";

router.post("/login", login);
router.get("/verify", protect , async(req, res) => {  
    const user = await UserProfile.findOne({ authUser: req.user.userId }).select("name");   
    res.status(200).json({ message: "Token is valid", user: {...req.user, name: user?.name }, success:true });
});

export default router;  