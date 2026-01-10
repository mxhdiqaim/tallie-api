export const UserStatusEnum = {
    ACTIVE: "active",
    INACTIVE: "inactive",
    DELETED: "deleted",
    BANNED: "banned",
} as const;

export const ReservationStatusEnum = {
    PENDING: "pending",
    CONFIRMED: "confirmed",
    SEATED: "seated",
    COMPLETED: "completed",
    CANCELLED: "cancelled",
} as const;