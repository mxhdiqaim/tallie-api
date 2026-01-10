import express from "express";
import { StatusCodes } from "http-status-codes";
import restaurants from "./restaurants-routes";

const router = express.Router();

router.get("/health", (_req, res) => {
    res.status(StatusCodes.OK).json({
        status: "ok",
        message: "API is up and running",
        timestamp: new Date().toISOString(),
    });
});

router.use("/restaurant", restaurants)

export default router;
