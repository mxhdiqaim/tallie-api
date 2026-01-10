import {CustomRequest} from "../types/express";
import db from '../db';
import {restaurants} from "../schema/restaurant-schema";
import { StatusCodes } from "http-status-codes";
import { Response } from "express";
import {tables} from "../schema/table-schema";
import {eq} from "drizzle-orm";
import {handleError} from "../service/error-handling";


/*
    * @description Get all tables for a specific restaurant
    * @route GET /api/v1/restaurant/:id/tables
    * @param id - Restaurant ID
 */
export const getAllRestaurantTables = async (req: CustomRequest, res: Response) => {
    try {
        const { id: restaurantId } = req.params;

        // Using Drizzle Relational Query API (if configured)
        const result = await db.query.restaurants.findFirst({
            where: eq(restaurants.id, restaurantId),
            with: {
                tables: true
            }
        });

        if (!result) return res.status(StatusCodes.NOT_FOUND).json({ error: "Not found" });

        res.status(StatusCodes.OK).json(result);
    } catch (error) {
        handleError(res, "Failed to get restaurant", StatusCodes.INTERNAL_SERVER_ERROR, error instanceof Error ? error : undefined);
    }
}

/**
 * @description Create a restaurant
 * @route POST /api/v1/restaurant/create
 */
export const createRestaurant = async (req: CustomRequest, res: Response) =>{
    try {
        const { name, openingTime, closingTime } = req.body;

        if (!name || !openingTime || !closingTime) {
            return handleError(res, "Missing required fields", StatusCodes.BAD_REQUEST);;
        }

        const newRestaurant = await db.insert(restaurants).values({
            name,
            openingTime,
            closingTime
        }).returning();

        res.status(StatusCodes.CREATED).json(newRestaurant[0]);
    } catch (error) {
        handleError(res, "Failed to create restaurant", StatusCodes.INTERNAL_SERVER_ERROR, error instanceof Error ? error : undefined);
    }
}

/*
 * @description Add a table to a restaurant
 * @route POST /api/v1/restaurant/:id/add-table
 * @body { tableNumber: number, capacity: number }
 * @param id - Restaurant ID
 */
export const addTableToRestaurant = async (req: CustomRequest, res: Response) => {
    try {
        const { id: restaurantId } = req.params;
        const { tableNumber, capacity } = req.body;

        if (!restaurantId || !tableNumber || !capacity) {
            return handleError(res, "Missing required fields", StatusCodes.BAD_REQUEST);
        }

        // Optional: Check if a restaurant exists first
        const restaurantExists = await db.select().from(restaurants).where(eq(restaurants.id, restaurantId));
        if (restaurantExists.length === 0) {
            return handleError(res, "Restaurant not found", StatusCodes.NOT_FOUND);
        }

        const newTable = await db.insert(tables).values({
            restaurantId,
            tableNumber,
            capacity
        }).returning();

        res.status(StatusCodes.CREATED).json(newTable[0]);
    } catch (error) {
        handleError(res, "Failed to add table", StatusCodes.INTERNAL_SERVER_ERROR, error instanceof Error ? error : undefined);
    }
}
