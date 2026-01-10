import {pgTable, varchar, time, timestamp, uuid} from 'drizzle-orm/pg-core';

// Restaurant Table
export const restaurants = pgTable('restaurants', {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    // Using 'time' for opening/closing to leverage DB-level time validation
    openingTime: time('openingTime').notNull(),
    closingTime: time('closingTime').notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    lastModified: timestamp("lastModified")
        .defaultNow()
        .notNull()
        .$onUpdateFn(() => new Date()),
});