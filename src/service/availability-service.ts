import {DateTime} from "luxon";
import db from "../db";
import {tables} from "../schema/table-schema";
import {and, eq, gte, lte} from "drizzle-orm";
import {reservations} from "../schema/reservation-schema";

export const getAvailableSlots = async (
    restaurantId: string,
    partySize: number,
    durationMinutes: number,
    dateISO?: string,
) => {
    const now = DateTime.now(); // Get the current time once
    const effectiveDate = dateISO || now.toISODate()!;
    const isToday = effectiveDate === now.toISODate();

    const restaurant = await db.query.restaurants.findFirst({
        where: (r, { eq }) => eq(r.id, restaurantId)
    });

    if (!restaurant) throw new Error("Restaurant not found");

    const day = DateTime.fromISO(effectiveDate);
    const timeFormat = restaurant.openingTime.length > 5 ? "HH:mm:ss" : "HH:mm";

    const openTime = DateTime.fromFormat(restaurant.openingTime, timeFormat).set({
        year: day.year, month: day.month, day: day.day
    });

    let closeTime = DateTime.fromFormat(restaurant.closingTime, timeFormat).set({
        year: day.year, month: day.month, day: day.day
    });

    if (closeTime <= openTime) closeTime = closeTime.plus({ days: 1 });

    // Potential Tables & Reservations Query
    const potentialTables = await db.select()
        .from(tables)
        .where(and(eq(tables.restaurantId, restaurantId), gte(tables.capacity, partySize)));

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
        // FILTER: If checking for today, skip slots that have already started
        const isPastSlot = isToday && currentSlot < now.plus({ minutes: 0 });

        if (!isPastSlot) {
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
        }

        currentSlot = currentSlot.plus({ minutes: 30 });
    }

    return {
        date: effectiveDate,
        slots: availableSlots
    };
};