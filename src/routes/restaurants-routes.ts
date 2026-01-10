import express from "express";
import * as controller from "../controllers/restaurant-controller";

const router = express.Router();

router.get("/:id/tables", controller.getAllRestaurantTables);
router.post("/create", controller.createRestaurant);
router.post("/:id/add-table", controller.addTableToRestaurant);

export = router;
