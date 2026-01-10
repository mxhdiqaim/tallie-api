import { and, lt, gt, eq } from "drizzle-orm";
import db from "../db";
import {reservations} from "../schema/reservation-schema";

export const isTableBusy = async (tableId: string, start: Date, end: Date) => {
    const overlapping = await db.select()
        .from(reservations)
        .where(
            and(
                eq(reservations.tableId, tableId),
                lt(reservations.startTime, end), // Existing start is before the new end
                gt(reservations.endTime, start)  // Existing end is after a new start
            )
        )
        .limit(1);

    return overlapping.length > 0;
}