import { Response } from "express";
import { DateTime } from 'luxon';
import { CustomRequest } from "../types/express";
import { restaurants } from "../schema/restaurant-schema";
import {and, desc, eq, gte, lte} from "drizzle-orm";
import db from "../db";
import { tables } from "../schema/table-schema";
import { isTableBusy } from "../service/is-table-busy";
import { reservations } from "../schema/reservation-schema";
import { StatusCodes } from "http-status-codes";
import { handleError } from "../service/error-handling";
import {ReservationStatusEnum} from "../types/enums";
import {getPeakLimit} from "../helper";
import {NotificationService} from "../service/notification-service";


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
 * @description Create a reservation with validation for hours, capacity, and double-booking
 * @route POST /api/v1/reservations/create
 */
export const createReservation = async (req: CustomRequest, res: Response) => {
    try {
        const { restaurantId, partySize, startTimeISO, durationMinutes, customerName, customerPhone, allowWaitlist } = req.body;

        // Parse requested times
        const requestedStart = DateTime.fromISO(startTimeISO);
        const requestedEnd = requestedStart.plus({ minutes: durationMinutes });

        //  Validation: Duration vs Peak Hours
        const maxAllowed = getPeakLimit(requestedStart);
        if (durationMinutes > maxAllowed) {
            return handleError(res, `Peak hour limit: ${maxAllowed} mins`, StatusCodes.BAD_REQUEST);
        }

        if (durationMinutes < 15) {
            return handleError(res, "Minimum reservation duration is 15 minutes.", StatusCodes.BAD_REQUEST);
        }


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

        if (requestedStart < openTime || requestedEnd > closeTime) {
            return handleError(res, "Outside operating hours", StatusCodes.BAD_REQUEST);
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
            .orderBy(tables.capacity);

        if (potentialTables.length === 0) {
            return handleError(res, `No tables found that can accommodate a party of ${partySize}.`, StatusCodes.BAD_REQUEST);
        }

        let assignedTableId: string | null = null;

        // The loop will now naturally pick the "Best Fit"
        // Example: Party of 2.
        // Database returns: [Table(Cap: 2), Table(Cap: 2), Table(Cap: 4), Table(Cap: 8)]
        // It will try both 2-seaters before "wasting" the 4-seater.
        for (const table of potentialTables) {
            const busy = await isTableBusy(table.id, requestedStart.toJSDate(), requestedEnd.toJSDate());
            if (!busy) {
                assignedTableId = table.id;
                break;
            }
        }

        // Handle Waitlist Logic
        if (!assignedTableId) {
            if (allowWaitlist) {
                const [waitlistEntry] = await db.insert(reservations).values({
                    restaurantId,
                    tableId: potentialTables[0]?.id, // Link to a compatible table type as a placeholder
                    customerName,
                    customerPhone: String(customerPhone),
                    partySize,
                    startTime: requestedStart.toJSDate(),
                    endTime: requestedEnd.toJSDate(),
                    reservationStatus: ReservationStatusEnum.WAITLIST
                }).returning();

                return res.status(StatusCodes.CREATED).json({
                    message: "No tables available, you have been added to the waitlist.",
                    data: waitlistEntry
                });
            }

            return handleError(res, "No tables available for this time.", StatusCodes.CONFLICT);
        }

        // Finalize Reservation
        const [newBooking] = await db.insert(reservations).values({
            restaurantId,
            tableId: assignedTableId,
            customerName,
            customerPhone: String(customerPhone), // Ensure it's stored as string
            partySize,
            startTime: requestedStart.toJSDate(),
            endTime: requestedEnd.toJSDate(),
            reservationStatus: ReservationStatusEnum.CONFIRMED
        }).returning();

        // Trigger Mock Notification
        await NotificationService.send({
            customerName: newBooking.customerName,
            customerPhone: newBooking.customerPhone,
            restaurantName: restaurant.name,
            startTime: newBooking.startTime,
            reservationStatus: newBooking.reservationStatus
        });

        return res.status(StatusCodes.CREATED).json(newBooking);

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

        // Look for Waitlisted people for the SAME time and SAME restaurant
        const waitlisted = await db.select().from(reservations)
            .where(and(
                eq(reservations.restaurantId, cancelled.restaurantId),
                eq(reservations.reservationStatus, ReservationStatusEnum.WAITLIST),
                // Only find people whose time overlaps with the now-vacant slot
                lte(reservations.startTime, cancelled.endTime),
                gte(reservations.endTime, cancelled.startTime)
            ))
            .orderBy(reservations.createdAt); // First come, first served

        // Check if any waitlisted entry fits the now-free table
        for (const entry of waitlisted) {
            const busy = await isTableBusy(cancelled.tableId, entry.startTime, entry.endTime);
            if (!busy) {
                // Promote to Confirmed!
                await db.update(reservations)
                    .set({ reservationStatus: ReservationStatusEnum.CONFIRMED, tableId: cancelled.tableId })
                    .where(eq(reservations.id, entry.id));

                // Fetch the restaurant name
                const [rest] = await db.select().from(restaurants).where(eq(restaurants.id, entry.restaurantId));

                // Trigger Promotion Alert
                await NotificationService.sendPromotionAlert(
                    entry.customerName,
                    entry.customerPhone,
                    rest.name
                );

                break;
            }
        }

        res.status(StatusCodes.OK).json({ message: "Cancelled and waitlist updated" });
    } catch (error) {
        handleError(res, "Cancellation failed", StatusCodes.INTERNAL_SERVER_ERROR, error instanceof Error ? error : undefined);
    }
};