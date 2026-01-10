import { Response } from "express";
import { DateTime } from 'luxon';
import {CustomRequest} from "../types/express";
import {restaurants} from "../schema/restaurant-schema";
import {and, eq, gt} from "drizzle-orm";
import db from "../db";
import {tables} from "../schema/table-schema";
import {isTableBusy} from "../service/is-table-busy";
import {reservations} from "../schema/reservation-schema";
import { StatusCodes } from "http-status-codes";
import {handleError} from "../service/error-handling";

/*
    * @description Create a reservation
    * @route POST /api/v1/reservation/create
*/
export const createReservation = async (req: CustomRequest, res: Response) => {
    try {
        const { restaurantId, partySize, startTimeISO, durationMinutes, customerName, customerPhone } = req.body;

        const requestedStart = DateTime.fromISO(startTimeISO);
        const requestedEnd = requestedStart.plus({ minutes: durationMinutes });

        if (!requestedStart.isValid) {
            return handleError(res, "Invalid date format", StatusCodes.BAD_REQUEST);
        }

        // Fetch Restaurant
        const [restaurant] = await db.select().from(restaurants).where(eq(restaurants.id, restaurantId));
        if (!restaurant) {
            return handleError(res, "Restaurant not found", StatusCodes.NOT_FOUND);
        }

        // Convert restaurant "HH:mm" strings to DateTime objects ON THE SAME DAY as the reservation
        const openTime = DateTime.fromFormat(restaurant.openingTime, "HH:mm", {
            zone: requestedStart.zoneName
        }).set({
            year: requestedStart.year,
            month: requestedStart.month,
            day: requestedStart.day
        });

        const closeTime = DateTime.fromFormat(restaurant.closingTime, "HH:mm", {
            zone: requestedStart.zoneName
        }).set({
            year: requestedStart.year,
            month: requestedStart.month,
            day: requestedStart.day
        });

        // Check if the requested window is within operating hours
        if (requestedStart < openTime || requestedEnd > closeTime) {
            return handleError(res, `Restaurant is only open between ${restaurant.openingTime} and ${restaurant.closingTime}`, StatusCodes.BAD_REQUEST);
        }

        // --- TABLE AVAILABILITY LOGIC ---

        // Find potential tables (Capacity check)
        const potentialTables = await db.select()
            .from(tables)
            .where(
                and(
                    eq(tables.restaurantId, restaurantId),
                    gt(tables.capacity, partySize - 1)
                )
            );

        let assignedTableId = null;

        for (const table of potentialTables) {
            const busy = await isTableBusy(table.id, requestedStart.toJSDate(), requestedEnd.toJSDate());
            if (!busy) {
                assignedTableId = table.id;
                break;
            }
        }

        if (!assignedTableId) {
            return handleError(res, "No tables available for this party size at this time", StatusCodes.CONFLICT);
        }

        // Create Reservation
        const [newBooking] = await db.insert(reservations).values({
            restaurantId,
            tableId: assignedTableId,
            customerName,
            customerPhone,
            partySize,
            startTime: requestedStart.toJSDate(),
            endTime: requestedEnd.toJSDate()
        }).returning();

        res.status(201).json(newBooking);
    } catch(error) {
        handleError(res, "Failed to create reservation", StatusCodes.INTERNAL_SERVER_ERROR, error instanceof Error ? error : undefined);
    }
};