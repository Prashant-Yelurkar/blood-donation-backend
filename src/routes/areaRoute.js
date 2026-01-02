import { Router } from "express";
import { addArea, deleteArea, getAreaDetails, getAreas, seedAreas, updateArea } from "../controller/areaController.js";
import { protect } from "../middleware/auth.js";
const router = Router();

router.get("/seed",seedAreas);
router.get("/", protect,getAreas)
router.get("/:id", protect,getAreaDetails)
router.delete("/:id", protect,deleteArea)
router.put("/:id", protect,updateArea)
router.post('/add',protect, addArea);


export default router;