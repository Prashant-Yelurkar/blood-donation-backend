import { Router  } from "express";

import { getAllRoles, seedRoles } from "../controller/roleController.js";
const router = Router();

router.get("/", (req, res) => {
  res.send("Role Route Working");
});

router.get("/all", getAllRoles);

router.get('/add' , seedRoles);


export default router;