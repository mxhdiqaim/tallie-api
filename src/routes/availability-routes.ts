import express from "express";
import * as controller from "../controllers/availability-controller";

const router = express.Router();

router.get("/check", controller.checkAvailability);

export = router;
