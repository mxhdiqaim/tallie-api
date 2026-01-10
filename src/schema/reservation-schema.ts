import { pgTable, uuid, timestamp, integer, varchar } from "drizzle-orm/pg-core";
import { tables } from "./table-schema";
import { restaurants } from "./restaurant-schema";

export const reservations = pgTable('reservations', {
    id: uuid("id").defaultRandom().primaryKey(),
    restaurantId: uuid('restaurantId')
        .references(() => restaurants.id, { onDelete: 'cascade' })
        .notNull(),
    tableId: uuid('tableId')
        .references(() => tables.id, { onDelete: 'cascade' })
        .notNull(),
    customerName: varchar('customerName', { length: 255 }).notNull(),
    customerPhone: varchar('customerPhone', { length: 20 }).notNull(),
    partySize: integer('partySize').notNull(),
    startTime: timestamp("startTime", { withTimezone: true }).notNull(),
    endTime: timestamp("endTime", { withTimezone: true }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    lastModified: timestamp("lastModified")
        .defaultNow()
        .notNull()
        .$onUpdateFn(() => new Date()),
});