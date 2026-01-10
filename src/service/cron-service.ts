import cron from 'node-cron';
import { and, lt, inArray } from 'drizzle-orm';
import { DateTime } from 'luxon';
import db from '../db';
import { reservations } from '../schema/reservation-schema';
import {ReservationStatusEnum} from "../types/enums";

export const initCronJobs = () => {
    // Runs every 15 minutes
    cron.schedule('*/15 * * * *', async () => {
        console.log('Running Auto-Complete Cron Job');

        try {
            const now = DateTime.now().toJSDate();

            const result = await db.update(reservations)
                .set({ reservationStatus: ReservationStatusEnum.COMPLETED })
                .where(
                    and(
                        // 1. Reservation has actually ended
                        lt(reservations.endTime, now),
                        // 2. Only complete those that weren't already cancelled
                        inArray(reservations.reservationStatus, [ReservationStatusEnum.COMPLETED, ReservationStatusEnum.SEATED])
                    )
                )
                .returning({ id: reservations.id });

            console.log(`Successfully completed ${result.length} reservations.`);
        } catch (error) {
            console.error('Cron Job Failed:', error);
        }
    });
};