import { pgTable, serial, varchar, time, timestamp } from 'drizzle-orm/pg-core';

// Restaurant Table
export const restaurants = pgTable('restaurants', {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    // Using 'time' for opening/closing to leverage DB-level time validation
    openingTime: time('opening_time').notNull(),
    closingTime: time('closing_time').notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    lastModified: timestamp("lastModified")
        .defaultNow()
        .notNull()
        .$onUpdateFn(() => new Date()),
});