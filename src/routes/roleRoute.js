import { Router  } from "express";

import { getAllRoles, seedRoles } from "../controller/roleController.js";
import { protect } from "../middleware/auth.js";
const router = Router();

router.get("/", (req, res) => {
  res.send("Role Route Working");
});

router.get("/all", protect ,getAllRoles);

router.get('/add' , seedRoles);


export default router;