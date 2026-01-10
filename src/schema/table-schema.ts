import {integer, pgTable, timestamp, uuid} from "drizzle-orm/pg-core";
import {restaurants} from "./restaurant-schema";

// Table (Physical furniture in the restaurant)
export const tables = pgTable('tables', {
    id: uuid("id").defaultRandom().primaryKey(),
    restaurantId: uuid('restaurantId')
        .references(() => restaurants.id, { onDelete: 'cascade' })
        .notNull(),
    tableNumber: integer('tableNumber').notNull(),
    capacity: integer('capacity').notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    lastModified: timestamp("lastModified")
        .defaultNow()
        .notNull()
        .$onUpdateFn(() => new Date()),
});