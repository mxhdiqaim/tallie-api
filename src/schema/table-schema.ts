import {integer, pgTable, serial, timestamp} from "drizzle-orm/pg-core";
import {restaurants} from "./restaurant-schema";

// Table (Physical furniture in the restaurant)
export const tables = pgTable('tables', {
    id: serial('id').primaryKey(),
    restaurantId: integer('restaurant_id')
        .references(() => restaurants.id, { onDelete: 'cascade' })
        .notNull(),
    tableNumber: integer('table_number').notNull(),
    capacity: integer('capacity').notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    lastModified: timestamp("lastModified")
        .defaultNow()
        .notNull()
        .$onUpdateFn(() => new Date()),
});