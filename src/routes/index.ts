import express from "express";
import { StatusCodes } from "http-status-codes";
import restaurants from "./restaurants-routes";
import reservations from "./reservation-routes";
import availability from "./availability-routes";

const router = express.Router();

router.get("/health", (_req, res) => {
    res.status(StatusCodes.OK).json({
        status: "ok",
        message: "API is up and running",
        timestamp: new Date().toISOString(),
    });
});

router.use("/restaurants", restaurants)
router.use("/reservations", reservations)
router.use("/availability", availability)

export default router;
