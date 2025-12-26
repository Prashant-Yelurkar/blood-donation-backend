import  { Router } from "express";
import { protect } from "../middleware/auth.js";
import { getMainDashboardSummary } from "../controller/dashboardController.js";
const router = Router();


router.get("/", getMainDashboardSummary);
export default router;