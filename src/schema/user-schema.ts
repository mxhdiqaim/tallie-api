import {
    pgEnum,
    pgTable,
    text,
    timestamp,
    uuid,
} from "drizzle-orm/pg-core";

export const userStatusEnum = pgEnum("status", [
    "active",
    "inactive",
    "deleted",
    "banned",
]);

// Users' table
export const users = pgTable(
    "users",
    {
        id: uuid("id").defaultRandom().primaryKey(), // Using UUIDs for IDs
        firstName: text("firstName").notNull(),
        lastName: text("lastName").notNull(),
        email: text("email").notNull(),
        password: text("password").notNull(),
        phone: text("phone").unique(),
        status: userStatusEnum("status").notNull().default("active"), // 'active' || 'inactive' || 'deleted'
        createdAt: timestamp("createdAt").defaultNow().notNull(),
        lastModified: timestamp("lastModified")
            .defaultNow()
            .notNull()
            .$onUpdateFn(() => new Date()),
    },
);

export type UserSchemaT = typeof users.$inferSelect;
export type InsertUserSchemaT = typeof users.$inferInsert; // Useful for strict typing on inserts
