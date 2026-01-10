import express from "express";
import * as controller from "../controllers/reservation-controller";

const router = express.Router();

router.get("/:phone", controller.getCustomerReservations);
router.patch("/:id", controller.updateReservation);
router.post("/create", controller.createReservation);
router.delete("/:id", controller.cancelReservation);

export = router;
