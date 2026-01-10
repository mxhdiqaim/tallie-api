import { integer, pgTable, timestamp, uuid, unique } from "drizzle-orm/pg-core"; // Added unique
import { restaurants } from "./restaurant-schema";

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
}, (table) => ({
    // This creates a composite unique constraint
    unique: unique().on(table.restaurantId, table.tableNumber),
}));