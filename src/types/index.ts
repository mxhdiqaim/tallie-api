import {ReservationStatus} from "./enums";

export type NotificationPayload = {
    customerName: string;
    customerPhone: string;
    restaurantName: string;
    startTime: Date;
    reservationStatus: ReservationStatus;
};