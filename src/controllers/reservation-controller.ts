import { Response } from "express";
import { DateTime } from 'luxon';
import { CustomRequest } from "../types/express";
import { restaurants } from "../schema/restaurant-schema";
import {and, desc, eq, gte} from "drizzle-orm";
import db from "../db";
import { tables } from "../schema/table-schema";
import { isTableBusy } from "../service/is-table-busy";
import { reservations } from "../schema/reservation-schema";
import { StatusCodes } from "http-status-codes";
import { handleError } from "../service/error-handling";
import {ReservationStatusEnum} from "../types/enums";


/**
 * @description Get all reservations for a customer by phone number
 * @route GET /api/v1/reservations/customer/:phone
 */
export const getCustomerReservations = async (req: CustomRequest, res: Response) => {
    try {
        const { phone } = req.params;

        if (!phone) {
            return handleError(res, "Phone number is required", StatusCodes.BAD_REQUEST);
        }
        const { upcomingOnly } = req.query;

        const queryFilters = [eq(reservations.customerPhone, phone)];

        if (upcomingOnly === 'true') {
            queryFilters.push(gte(reservations.startTime, DateTime.now().toJSDate()));
        }

        const results = await db.select({
            reservationId: reservations.id,
            startTime: reservations.startTime,
            endTime: reservations.endTime,
            partySize: reservations.partySize,
            restaurantName: restaurants.name,
            // Include other restaurant details if needed
        })
            .from(reservations)
            .innerJoin(restaurants, eq(reservations.restaurantId, restaurants.id))
            .where(and(...queryFilters))
            .orderBy(desc(reservations.startTime)); // Newest first

        if (results.length === 0) {
            return res.status(StatusCodes.OK).json({
                message: "No reservations found for this phone number",
                data: []
            });
        }

        res.status(StatusCodes.OK).json(results);
    } catch (error) {
        handleError(res, "Failed to fetch customer reservations", StatusCodes.INTERNAL_SERVER_ERROR, error instanceof Error ? error : undefined);
    }
};

/**
 * @description Modify a reservation (Update status, time, or party size)
 * @route PATCH /api/v1/reservations/:id
 */
export const updateReservation = async (req: CustomRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { partySize, startTimeISO, durationMinutes } = req.body;

        // Fetch existing reservation
        const [existing] = await db.select().from(reservations).where(eq(reservations.id, id));
        if (!existing) return handleError(res, "Reservation not found", StatusCodes.NOT_FOUND);

        const updateData: any = {};

        // Handle Status Update
        // if (reservationStatus) updateData.reservationStatus = reservationStatus;

        // Handle Time/Capacity Changes
        if (startTimeISO || partySize || durationMinutes) {
            const newStart = startTimeISO ? DateTime.fromISO(startTimeISO) : DateTime.fromJSDate(existing.startTime);
            const newDuration = durationMinutes ||
                DateTime.fromJSDate(existing.endTime).diff(DateTime.fromJSDate(existing.startTime), 'minutes').minutes;
            const newEnd = newStart.plus({ minutes: newDuration });
            const newSize = partySize || existing.partySize;

            // Check if the table is still free for the NEW time (excluding this reservation itself)
            const busy = await isTableBusy(existing.tableId, newStart.toJSDate(), newEnd.toJSDate(), id);

            if (busy) return handleError(res, "The table is already booked for this new time", StatusCodes.CONFLICT);

            updateData.startTime = newStart.toJSDate();
            updateData.endTime = newEnd.toJSDate();
            updateData.partySize = newSize;
        }

        const [updated] = await db.update(reservations)
            .set(updateData)
            .where(eq(reservations.id, id))
            .returning();

        res.status(StatusCodes.OK).json(updated);
    } catch (error) {
        handleError(res, "Update failed", StatusCodes.INTERNAL_SERVER_ERROR, error instanceof Error ? error : undefined);
    }
};

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
                    gte(tables.capacity, partySize)
                )
            )
            .orderBy(tables.capacity); // Tries to fill the smallest suitable table first

        if (potentialTables.length === 0) {
            return handleError(
                res,
                `This restaurant does not have any tables that can accommodate party ${partySize} people.`,
                StatusCodes.BAD_REQUEST
            );
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

/**
 * @description Cancel a reservation (Soft cancel by updating status)
 * @route DELETE /api/v1/reservation/:id
 */
export const cancelReservation = async (req: CustomRequest, res: Response) => {
    try {
        const { id } = req.params;

        const [cancelled] = await db.update(reservations)
            .set({ reservationStatus: ReservationStatusEnum.CANCELLED })
            .where(eq(reservations.id, id))
            .returning();

        if (!cancelled) return handleError(res, "Reservation not found", StatusCodes.NOT_FOUND);

        res.status(StatusCodes.OK).json({ message: "Reservation cancelled", data: cancelled });
    } catch (error) {
        handleError(res, "Cancellation failed", StatusCodes.INTERNAL_SERVER_ERROR, error instanceof Error ? error : undefined);
    }
};