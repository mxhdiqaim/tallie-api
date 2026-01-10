import {CustomRequest} from "../types/express";
import db from '../db';
import {restaurants} from "../schema/restaurant-schema";
import { StatusCodes } from "http-status-codes";
import { Response } from "express";
import {tables} from "../schema/table-schema";
import {and, eq, gte, lte} from "drizzle-orm";
import {handleError} from "../service/error-handling";
import {DateTime} from "luxon";
import {reservations} from "../schema/reservation-schema";

/**
 * @description Get all restaurants
 * @route GET /api/v1/restaurants
 */
export const getAllRestaurants = async (req: CustomRequest, res: Response) => {
    try {
        const allRestaurants = await db.select().from(restaurants);
        res.status(StatusCodes.OK).json(allRestaurants);
    } catch (error) {
        handleError(res, "Failed to fetch restaurants", StatusCodes.INTERNAL_SERVER_ERROR, error instanceof Error ? error : undefined);
    }
};

/**
 * @description Get all reservations for a restaurant on a specific date
 * @route GET /api/v1/restaurants/:id/reservations?date=YYYY-MM-DD
 */
export const getRestaurantReservationsByDate = async (req: CustomRequest, res: Response) => {
    try {
        const { id: restaurantId } = req.params;
        const { date } = req.query;

        if (!date) {
            return handleError(res, "Date query parameter is required", StatusCodes.BAD_REQUEST);
        }

        // Force Luxon to interpret the date in UTC
        const dayStart = DateTime.fromISO(date as string, { zone: 'utc' }).startOf('day');
        const dayEnd = dayStart.endOf('day');

        if (!dayStart.isValid) {
            return handleError(res, "Invalid date format. Use YYYY-MM-DD", StatusCodes.BAD_REQUEST);
        }

        // Query the database
        const results = await db.select({
            id: reservations.id,
            customerName: reservations.customerName,
            startTime: reservations.startTime,
            partySize: reservations.partySize,
            tableNumber: tables.tableNumber, // From joined table
            capacity: tables.capacity
        })
            .from(reservations)
            .innerJoin(tables, eq(reservations.tableId, tables.id))
            .where(
                and(
                    eq(reservations.restaurantId, restaurantId),
                    gte(reservations.startTime, dayStart.toJSDate()),
                    lte(reservations.startTime, dayEnd.toJSDate())
                )
            );

        res.status(StatusCodes.OK).json(results);
    } catch (error) {
        handleError(res, "Failed to fetch reservations", StatusCodes.INTERNAL_SERVER_ERROR, error instanceof Error ? error : undefined);
    }
};

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

        // Check if restaurant exists
        const restaurantExists = await db.select().from(restaurants).where(eq(restaurants.id, restaurantId));
        if (restaurantExists.length === 0) {
            return handleError(res, "Restaurant not found", StatusCodes.NOT_FOUND);
        }

        // Check if the table number already exists FOR THIS restaurant
        const tableConflict = await db.select()
            .from(tables)
            .where(
                and(
                    eq(tables.restaurantId, restaurantId),
                    eq(tables.tableNumber, tableNumber)
                )
            );

        if (tableConflict.length > 0) {
            return handleError(res, `Table number ${tableNumber} already exists in this restaurant`, StatusCodes.CONFLICT);
        }

        // Insert if all checks pass
        const [newTable] = await db.insert(tables).values({
            restaurantId,
            tableNumber,
            capacity
        }).returning();

        res.status(StatusCodes.CREATED).json(newTable);
    } catch (error) {
        handleError(res, "Failed to add table", StatusCodes.INTERNAL_SERVER_ERROR, error instanceof Error ? error : undefined);
    }
}
