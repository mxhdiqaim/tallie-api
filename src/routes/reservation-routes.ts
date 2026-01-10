import express from "express";
import * as controller from "../controllers/reservation-controller";

const router = express.Router();

router.get("/:phone", controller.getCustomerReservations);
router.post("/create", controller.createReservation);

export = router;
