import { Response } from "express";
import { DateTime } from 'luxon';
import { CustomRequest } from "../types/express";
import { restaurants } from "../schema/restaurant-schema";
import { and, eq, gt } from "drizzle-orm";
import db from "../db";
import { tables } from "../schema/table-schema";
import { isTableBusy } from "../service/is-table-busy";
import { reservations } from "../schema/reservation-schema";
import { StatusCodes } from "http-status-codes";
import { handleError } from "../service/error-handling";

/**
 * @description Create a reservation with validation for hours, capacity, and double-booking
 * @route POST /api/v1/reservations/create
 */
export const createReservation = async (req: CustomRequest, res: Response) => {
    try {
        const { restaurantId, partySize, startTimeISO, durationMinutes, customerName, customerPhone } = req.body;

        // Parse requested times
        const requestedStart = DateTime.fromISO(startTimeISO);
        const requestedEnd = requestedStart.plus({ minutes: durationMinutes });

        if (!requestedStart.isValid) {
            return handleError(res, "Invalid date format in startTimeISO", StatusCodes.BAD_REQUEST);
        }

        // Fetch Restaurant Details
        const [restaurant] = await db.select().from(restaurants).where(eq(restaurants.id, restaurantId));
        if (!restaurant) {
            return handleError(res, "Restaurant not found", StatusCodes.NOT_FOUND);
        }

        // Operating Hours Validation
        // Handle both "HH:mm" and "HH:mm:ss" formats from DB
        const timeFormat = restaurant.openingTime.length > 5 ? "HH:mm:ss" : "HH:mm";

        const openTime = DateTime.fromFormat(restaurant.openingTime, timeFormat, {
            zone: requestedStart.zoneName
        }).set({
            year: requestedStart.year,
            month: requestedStart.month,
            day: requestedStart.day
        });

        let closeTime = DateTime.fromFormat(restaurant.closingTime, timeFormat, {
            zone: requestedStart.zoneName
        }).set({
            year: requestedStart.year,
            month: requestedStart.month,
            day: requestedStart.day
        });

        // Handle overnight hours (e.g. 6 PM to 2 AM)
        if (closeTime <= openTime) {
            closeTime = closeTime.plus({ days: 1 });
        }

        // Perform the check
        const isWithinHours = requestedStart >= openTime && requestedEnd <= closeTime;
        if (!isWithinHours) {
            return handleError(
                res,
                `Restaurant is only open between ${restaurant.openingTime} and ${restaurant.closingTime}.`,
                StatusCodes.BAD_REQUEST
            );
        }

        // Find Suitable Tables (Capacity Check)
        // We look for tables belonging to the restaurant where capacity >= partySize
        const potentialTables = await db.select()
            .from(tables)
            .where(
                and(
                    eq(tables.restaurantId, restaurantId),
                    gt(tables.capacity, partySize - 1)
                )
            );

        if (potentialTables.length === 0) {
            return handleError(res, "No tables in this restaurant can accommodate this party size", StatusCodes.BAD_REQUEST);
        }

        // Availability Check (Double-Booking Prevention)
        let assignedTableId: string | null = null;

        for (const table of potentialTables) {
            const busy = await isTableBusy(table.id, requestedStart.toJSDate(), requestedEnd.toJSDate());
            if (!busy) {
                assignedTableId = table.id;
                break; // Found a free table, stop looking
            }
        }

        if (!assignedTableId) {
            return handleError(res, "The slot is not available at the current time.", StatusCodes.CONFLICT);
        }

        // Finalize Reservation
        const [newBooking] = await db.insert(reservations).values({
            restaurantId,
            tableId: assignedTableId,
            customerName,
            customerPhone: String(customerPhone), // Ensure it's stored as string
            partySize,
            startTime: requestedStart.toJSDate(),
            endTime: requestedEnd.toJSDate()
        }).returning();

        return res.status(StatusCodes.CREATED).json({
            message: "Reservation created successfully",
            data: newBooking
        });

    } catch (error) {
        return handleError(
            res,
            "Failed to create reservation",
            StatusCodes.INTERNAL_SERVER_ERROR,
            error instanceof Error ? error : undefined
        );
    }
};