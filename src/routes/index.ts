import express from "express";
import { StatusCodes } from "http-status-codes";

const router = express.Router();

router.get("/health", (_req, res) => {
    res.status(StatusCodes.OK).json({
        status: "ok",
        message: "API is up and running",
        timestamp: new Date().toISOString(),
    });
});

export default router;
