import express from "express";
import * as controller from "../controllers/reservation-controller";

const router = express.Router();

router.post("/create", controller.createReservation);

export = router;
