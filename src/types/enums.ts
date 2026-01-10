export const UserStatusEnum = {
    ACTIVE: "active",
    INACTIVE: "inactive",
    DELETED: "deleted",
    BANNED: "banned",
} as const;
export type UserStatus = keyof typeof UserStatusEnum;

export const ReservationStatusEnum = {
    PENDING: "pending",
    CONFIRMED: "confirmed",
    SEATED: "seated",
    COMPLETED: "completed",
    CANCELLED: "cancelled",
    WAITLIST: "waitlist",
} as const;

export const RESERVATION_STATUS = Object.values(ReservationStatusEnum);

export type ReservationStatus = typeof RESERVATION_STATUS[number];
