import { DateTime } from 'luxon';
import { and, eq, gte, lte, inArray } from 'drizzle-orm';
import db from '../db';
import { tables } from '../schema/table-schema';
import { reservations } from '../schema/reservation-schema';
import { restaurants } from '../schema/restaurant-schema';
import { redisClient } from "../config/redis-config";
import {getPeakLimit} from "../helper";
import {ReservationStatusEnum} from "../types/enums";

/**
 * Calculates available reservation slots for a given restaurant, party size, and date.
 * It checks for table capacity and existing reservations to determine availability.
 * Results are cached in Redis to improve performance for later requests.
 * @param restaurantId - The UUID of the restaurant.
 * @param partySize - The number of people in the party.
 * @param durationMinutes - The desired duration of the reservation in minutes.
 * @param dateISO - The target date in ISO format (e.g. "2025-07-21"). Defaults to the current date.
 * @returns A promise that resolves to an object containing the date and a list of available time slots.
 */
export const getAvailableSlots = async (
    restaurantId: string,
    partySize: number,
    durationMinutes: number,
    dateISO?: string
) => {
    // Determine the effective date for the availability check. Use today if no date is provided.
    const now = DateTime.now();
    const effectiveDate = dateISO || now.toISODate()!;
    const isToday = effectiveDate === now.toISODate();

    // Define a unique cache key for this specific availability request.
    const cacheKey = `availability:${restaurantId}:${effectiveDate}:${partySize}:${durationMinutes}`;

    // Attempt fetching the result from the Redis cache first.
    try {
        const cachedData = await redisClient.get(cacheKey);
        if (cachedData) {
            // If cache hit, parse and return the stored data immediately.
            return JSON.parse(cachedData);
        }
    } catch (err) {
        console.error("Redis Cache Error (Get):", err);
    }

    // Cache Miss: Proceed with database computation.
    // Fetch restaurant details to get opening and closing times.
    const restaurant = await db.query.restaurants.findFirst({
        where: eq(restaurants.id, restaurantId)
    });
    if (!restaurant) throw new Error("Restaurant not found");

    // Parse the restaurant opening and closing time for the specified date.
    const day = DateTime.fromISO(effectiveDate);
    const timeFormat = restaurant.openingTime.length > 5 ? "HH:mm:ss" : "HH:mm";

    const openTime = DateTime.fromFormat(restaurant.openingTime, timeFormat).set({
        year: day.year, month: day.month, day: day.day
    });
    let closeTime = DateTime.fromFormat(restaurant.closingTime, timeFormat).set({
        year: day.year, month: day.month, day: day.day
    });

    // Handle overnight hours when closing time is on the next day.
    if (closeTime <= openTime) closeTime = closeTime.plus({ days: 1 });

    // Fetch all tables for the restaurant that can accommodate the party size.
    const potentialTables = await db.select().from(tables)
        .where(and(eq(tables.restaurantId, restaurantId), gte(tables.capacity, partySize)));

    // Fetch all active reservations for the given day to check for conflicts.
    const activeReservations = await db.select().from(reservations)
        .where(and(
            eq(reservations.restaurantId, restaurantId),
            inArray(reservations.reservationStatus, [
                ReservationStatusEnum.CONFIRMED,
                ReservationStatusEnum.SEATED,
                ReservationStatusEnum.PENDING
            ]),
            gte(reservations.startTime, openTime.toJSDate()),
            lte(reservations.endTime, closeTime.toJSDate())
        ));

    const availableSlots: string[] = [];
    let currentSlot = openTime;

    // Iterating through time slots from opening to closing time in 30-minute increments.
    while (currentSlot.plus({ minutes: durationMinutes }) <= closeTime) {
        // Get peak time reservation duration limit.
        const maxAllowed = getPeakLimit(currentSlot);
        // Check if the current slot is in the past (with a 15-minute buffer).
        const isPast = isToday && currentSlot < now.plus({ minutes: 15 });

        // Only consider future slots where the requested duration is within the allowed limit.
        if (!isPast && durationMinutes <= maxAllowed) {
            const slotEnd = currentSlot.plus({ minutes: durationMinutes });

            // Check if at least one potential table is free during this time slot.
            const isAnyTableFree = potentialTables.some(table => {
                return !activeReservations.some(res => {
                    if (res.tableId !== table.id) return false;
                    return currentSlot < DateTime.fromJSDate(res.endTime) &&
                        slotEnd > DateTime.fromJSDate(res.startTime);
                });
            });

            // If a free table is found, add the slot to the list of available slots.
            if (isAnyTableFree) availableSlots.push(currentSlot.toFormat('HH:mm'));
        }

        // Move to the next 30-minute interval.
        currentSlot = currentSlot.plus({ minutes: 30 });
    }

    const result = { date: effectiveDate, slots: availableSlots };

    // Store result in Redis with a TTL (e.g. 300 seconds / 5 minutes)
    try {
        await redisClient.setEx(cacheKey, 300, JSON.stringify(result));
    } catch (err) {
        console.error("Redis Cache Error (Set):", err);
    }

    return result;
};