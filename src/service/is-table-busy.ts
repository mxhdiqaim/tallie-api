import {and, lt, gt, eq, not} from "drizzle-orm";
import db from "../db";
import {reservations} from "../schema/reservation-schema";
import {ReservationStatusEnum} from "../types/enums";

export const isTableBusy = async (tableId: string, start: Date, end: Date, excludeId?: string) => {
    const filters = [
        eq(reservations.tableId, tableId),
        lt(reservations.startTime, end),
        gt(reservations.endTime, start),
        // Filter out 'cancelled' bookings so they don't block slots!
        not(eq(reservations.reservationStatus, ReservationStatusEnum.CANCELLED))
    ];

    if (excludeId) {
        filters.push(not(eq(reservations.id, excludeId)));
    }

    const overlapping = await db.select().from(reservations).where(and(...filters)).limit(1);
    return overlapping.length > 0;
};