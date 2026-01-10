import express from "express";
import * as controller from "../controllers/restaurant-controller";

const router = express.Router();

router.post("/create", controller.createRestaurant);

export = router;
