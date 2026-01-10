import { DateTime } from 'luxon';
import { and, eq, gte, lte, inArray } from 'drizzle-orm';
import db from '../db';
import { tables } from '../schema/table-schema';
import { reservations } from '../schema/reservation-schema';
import { restaurants } from '../schema/restaurant-schema';
import {ReservationStatusEnum} from "../types/enums";
import {getPeakLimit} from "../helper";

export const getAvailableSlots = async (
    restaurantId: string,
    partySize: number,
    durationMinutes: number,
    dateISO?: string
) => {
    const now = DateTime.now();
    const effectiveDate = dateISO || now.toISODate()!;
    const isToday = effectiveDate === now.toISODate();

    const restaurant = await db.query.restaurants.findFirst({
        where: eq(restaurants.id, restaurantId)
    });
    if (!restaurant) throw new Error("Restaurant not found");

    const day = DateTime.fromISO(effectiveDate);
    const tFormat = restaurant.openingTime.length > 5 ? "HH:mm:ss" : "HH:mm";

    const openTime = DateTime.fromFormat(restaurant.openingTime, tFormat).set({
        year: day.year, month: day.month, day: day.day
    });
    let closeTime = DateTime.fromFormat(restaurant.closingTime, tFormat).set({
        year: day.year, month: day.month, day: day.day
    });
    if (closeTime <= openTime) closeTime = closeTime.plus({ days: 1 });

    const potentialTables = await db.select().from(tables)
        .where(and(eq(tables.restaurantId, restaurantId), gte(tables.capacity, partySize)));

    const activeReservations = await db.select().from(reservations)
        .where(and(
            eq(reservations.restaurantId, restaurantId),
            inArray(reservations.reservationStatus, [ReservationStatusEnum.CONFIRMED, ReservationStatusEnum.SEATED,  ReservationStatusEnum.PENDING]),
            gte(reservations.startTime, openTime.toJSDate()),
            lte(reservations.endTime, closeTime.toJSDate())
        ));

    const availableSlots: string[] = [];
    let currentSlot = openTime;

    while (currentSlot.plus({ minutes: durationMinutes }) <= closeTime) {
        // Peak Hour Check
        const maxAllowed = getPeakLimit(currentSlot);
        const isPast = isToday && currentSlot < now.plus({ minutes: 15 });

        if (!isPast && durationMinutes <= maxAllowed) {
            const slotEnd = currentSlot.plus({ minutes: durationMinutes });

            const isAnyTableFree = potentialTables.some(table => {
                return !activeReservations.some(res => {
                    if (res.tableId !== table.id) return false;
                    return currentSlot < DateTime.fromJSDate(res.endTime) &&
                        slotEnd > DateTime.fromJSDate(res.startTime);
                });
            });

            if (isAnyTableFree) availableSlots.push(currentSlot.toFormat('HH:mm'));
        }
        currentSlot = currentSlot.plus({ minutes: 30 });
    }

    return { date: effectiveDate, slots: availableSlots };
};