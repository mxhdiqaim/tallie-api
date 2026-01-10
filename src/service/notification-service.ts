import {ReservationStatusEnum} from "../types/enums";
import {NotificationPayload} from "../types";


export class NotificationService {
    static async send(payload: NotificationPayload) {
        const { customerName, customerPhone, restaurantName, startTime, reservationStatus } = payload;
        const formattedTime = new Date(startTime).toLocaleString();

        console.log(`\n--- 🔔 NOTIFICATION SYSTEM ---`);
        console.log(`To: ${customerName} (${customerPhone})`);

        switch (reservationStatus) {
            case ReservationStatusEnum.CONFIRMED:
                console.log(`MESSAGE: Hi ${customerName}, your table at ${restaurantName} is CONFIRMED for ${formattedTime}. See you then!`);
                break;
            case ReservationStatusEnum.WAITLIST:
                console.log(`MESSAGE: Hi ${customerName}, ${restaurantName} is full, but you're on the WAITLIST for ${formattedTime}. We'll alert you if a spot opens!`);
                break;
            case ReservationStatusEnum.CANCELLED:
                console.log(`MESSAGE: Hi ${customerName}, your reservation at ${restaurantName} has been CANCELLED.`);
                break;
        }
        console.log(`------------------------------\n`);
    }

    static async sendPromotionAlert(customerName: string, customerPhone: string, restaurantName: string) {
        console.log(`\n--- 🚀 WAITLIST PROMOTION ---`);
        console.log(`To: ${customerName} (${customerPhone})`);
        console.log(`MESSAGE: Good news ${customerName}! A spot opened up at ${restaurantName}. Your waitlist entry has been upgraded to a CONFIRMED reservation!`);
        console.log(`------------------------------\n`);
    }
}