import {DateTime} from "luxon";
import db from "../db";
import {tables} from "../schema/table-schema";
import {and, eq, gte, lte} from "drizzle-orm";
import {reservations} from "../schema/reservation-schema";

export const getAvailableSlots = async (
    restaurantId: string,
    partySize: number,
    durationMinutes: number,
    dateISO?: string, // Made optional
) => {
    // Set the default date to Today (UTC or Local depending on your preference)
    // .toISODate() returns "YYYY-MM-DD"
    const effectiveDate = dateISO || DateTime.now().toISODate()!;

    // Setup Times
    const restaurant = await db.query.restaurants.findFirst({
        where: (r, { eq }) => eq(r.id, restaurantId)
    });

    if (!restaurant) throw new Error("Restaurant not found");

    // Use the effectiveDate here
    const day = DateTime.fromISO(effectiveDate);

    // Safety: split can fail if a time format is unexpected, so we use Luxon's parser
    const timeFormat = restaurant.openingTime.length > 5 ? "HH:mm:ss" : "HH:mm";

    const openTime = DateTime.fromFormat(restaurant.openingTime, timeFormat).set({
        year: day.year, month: day.month, day: day.day
    });

    let closeTime = DateTime.fromFormat(restaurant.closingTime, timeFormat).set({
        year: day.year, month: day.month, day: day.day
    });

    // Handle overnight closing (e.g. opens 6pm, closes 2am)
    if (closeTime <= openTime) {
        closeTime = closeTime.plus({ days: 1 });
    }

    // Get all tables that fit the party
    const potentialTables = await db.select()
        .from(tables)
        .where(and(eq(tables.restaurantId, restaurantId), gte(tables.capacity, partySize)));

    // Get all existing reservations for those tables on that day range
    const existingReservations = await db.select()
        .from(reservations)
        .where(and(
            eq(reservations.restaurantId, restaurantId),
            gte(reservations.startTime, openTime.toJSDate()),
            lte(reservations.endTime, closeTime.toJSDate())
        ));

    const availableSlots: string[] = [];
    let currentSlot = openTime;

    while (currentSlot.plus({ minutes: durationMinutes }) <= closeTime) {
        const slotEnd = currentSlot.plus({ minutes: durationMinutes });

        const isAnyTableFree = potentialTables.some(table => {
            const hasOverlap = existingReservations.some(reservation => {
                if (reservation.tableId !== table.id) return false;
                const resStart = DateTime.fromJSDate(reservation.startTime);
                const resEnd = DateTime.fromJSDate(reservation.endTime);
                return currentSlot < resEnd && slotEnd > resStart;
            });
            return !hasOverlap;
        });

        if (isAnyTableFree) {
            availableSlots.push(currentSlot.toFormat('HH:mm'));
        }
        currentSlot = currentSlot.plus({ minutes: 30 });
    }

    return {
        date: effectiveDate,
        slots: availableSlots
    };
};