import {CustomRequest} from "../types/express";
import db from '../db';
import {restaurants} from "../schema/restaurant-schema";
import { StatusCodes } from "http-status-codes";
import { Response } from "express";

/**
 * @description Create a restaurant
 * @route POST /api/v1/restaurant/create
 */
export const createRestaurant = async (req: CustomRequest, res: Response) =>{
    try {
        const { name, openingTime, closingTime } = req.body;

        if (!name || !openingTime || !closingTime) {
            return res.status(StatusCodes.BAD_REQUEST).json({ error: "Missing required fields" });
        }

        const newRestaurant = await db.insert(restaurants).values({
            name,
            openingTime,
            closingTime
        }).returning();

        res.status(StatusCodes.CREATED).json(newRestaurant[0]);
    } catch (error) {
        res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: "Failed to create restaurant" });
    }
}
