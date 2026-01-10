import { DateTime } from 'luxon';
import { and, eq, gte, lte } from 'drizzle-orm';
import db from '../db';
import { tables } from '../schema/table-schema';
import { reservations } from '../schema/reservation-schema';

export const getAvailableSlots = async (
    restaurantId: string,
    dateISO: string, // e.g., "2024-05-20"
    partySize: number,
    durationMinutes: number
) => {
    // Setup Times
    const restaurant = await db.query.restaurants.findFirst({
        where: (r, { eq }) => eq(r.id, restaurantId)
    });

    if (!restaurant) throw new Error("Restaurant not found");

    const day = DateTime.fromISO(dateISO);
    const openTime = day.set({
        hour: parseInt(restaurant.openingTime.split(':')[0]),
        minute: parseInt(restaurant.openingTime.split(':')[1])
    });
    const closeTime = day.set({
        hour: parseInt(restaurant.closingTime.split(':')[0]),
        minute: parseInt(restaurant.closingTime.split(':')[1])
    });

    // Get all tables that fit the party
    const potentialTables = await db.select()
        .from(tables)
        .where(and(eq(tables.restaurantId, restaurantId), gte(tables.capacity, partySize)));

    // Get all existing reservations for those tables on that day
    const existingReservations = await db.select()
        .from(reservations)
        .where(and(
            eq(reservations.restaurantId, restaurantId),
            gte(reservations.startTime, openTime.toJSDate()),
            lte(reservations.endTime, closeTime.toJSDate())
        ));

    // Generate potential slots (every 30 mins)
    const availableSlots: string[] = [];
    let currentSlot = openTime;

    while (currentSlot.plus({ minutes: durationMinutes }) <= closeTime) {
        const slotEnd = currentSlot.plus({ minutes: durationMinutes });

        // Check if ANY table is free for this specific time slice
        const isAnyTableFree = potentialTables.some(table => {
            const hasOverlap = existingReservations.some(reservation => {
                if (reservation.tableId !== table.id) return false;

                // Overlap check: (StartA < EndB) && (EndA > StartB)
                const resStart = DateTime.fromJSDate(reservation.startTime);
                const resEnd = DateTime.fromJSDate(reservation.endTime);
                return currentSlot < resEnd && slotEnd > resStart;
            });
            return !hasOverlap;
        });

        if (isAnyTableFree) {
            availableSlots.push(currentSlot.toFormat('HH:mm'));
        }

        currentSlot = currentSlot.plus({ minutes: 30 }); // Increment by 30 mins
    }

    return availableSlots;
};